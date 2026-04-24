/****************************************************

* ALM V3 Grid Encoder — script.js
  ****************************************************/

const SIZE = 1024;
const LMAX = 12;
const B = 32;

/**************** CHAR TABLE ****************/
const indexToChar = {
1:"ا",2:"ب",3:"ت",4:"ث",5:"ج",6:"ح",7:"خ",8:"د",9:"ذ",
10:"ر",11:"ز",12:"س",13:"ش",14:"ص",15:"ض",16:"ط",
17:"ظ",18:"ع",19:"غ",20:"ف",21:"ق",22:"ك",23:"ل",
24:"م",25:"ن",26:"ه",27:"و",28:"ي"
};

const charToIndex = {};
for (let k in indexToChar) charToIndex[indexToChar[k]] = Number(k);

/**************** TEXT CLEAN ****************/
function normalizeArabic(s){
return (s || "")
.replace(/[إأآ]/g,"ا")
.replace(/ى/g,"ي")
.replace(/ة/g,"ه");
}

function cleanText(t){
t = normalizeArabic(t);
return t.replace(/\s+/g," ").trim();
}

/**************** WORD <-> BIGINT ****************/
function wordToCode(w){
const c = new Array(LMAX).fill(0);
let p = 0;

for(let i = w.length - 1; i >= 0; i--){
const idx = charToIndex[w[i]];
if(idx){
c[p++] = idx;
if(p >= LMAX) break;
}
}

let C = 0n;
for(let i = 0; i < LMAX; i++){
C += BigInt(c[i]) * (BigInt(B) ** BigInt(i));
}
return C;
}

function codeToWord(C){
let out = "";
for(let i = 0; i < LMAX; i++){
const d = Number(C % BigInt(B));
C /= BigInt(B);
if(d) out = indexToChar[d] + out;
}
return out;
}

/**************** FILE EXTRACT ****************/
async function extractText(file){

// DOCX
if(file.name.toLowerCase().endsWith(".docx")){
const buf = await file.arrayBuffer();
const res = await mammoth.extractRawText({arrayBuffer: buf});
return res.value || "";
}

// PDF
if(file.name.toLowerCase().endsWith(".pdf")){
const buf = await file.arrayBuffer();
const pdf = await pdfjsLib.getDocument({data: buf}).promise;

let text = "";
for(let i = 1; i <= pdf.numPages; i++){
  const page = await pdf.getPage(i);
  const content = await page.getTextContent();
  text += content.items.map(x => x.str).join(" ") + "\n";
}
return text;

}

throw new Error("نوع الملف غير مدعوم");
}

/**************** BITS ****************/
function bytesToBits(bytes){
const bits = [];
for(const b of bytes){
for(let i = 7; i >= 0; i--){
bits.push((b >> i) & 1);
}
}
return bits;
}

function bitsToBytes(bits){
const bytes = [];
for(let i = 0; i < bits.length; i += 8){
let b = 0;
for(let j = 0; j < 8; j++){
b = (b << 1) | (bits[i + j] || 0);
}
bytes.push(b);
}
return new Uint8Array(bytes);
}

/**************** DRAW GRID ****************/
function drawGrid(ctx, bits, size){
const cells = Math.ceil(Math.sqrt(bits.length));
const cellSize = Math.floor(size / cells);

ctx.fillStyle = "#fff";
ctx.fillRect(0, 0, size, size);

let i = 0;

for(let y = 0; y < cells; y++){
for(let x = 0; x < cells; x++){
const bit = bits[i++] || 0;

  ctx.fillStyle = bit ? "#000" : "#fff";
  ctx.fillRect(
    x * cellSize,
    y * cellSize,
    cellSize,
    cellSize
  );
}

}

return cells;
}

/**************** READ GRID ****************/
function readGrid(ctx, size, cells){
const cellSize = Math.floor(size / cells);
const img = ctx.getImageData(0,0,size,size).data;

const bits = [];

for(let y = 0; y < cells; y++){
for(let x = 0; x < cells; x++){

  let sum = 0;
  let count = 0;

  for(let dy = 0; dy < cellSize; dy++){
    for(let dx = 0; dx < cellSize; dx++){
      const px = (y * cellSize + dy) * size + (x * cellSize + dx);
      const i = px * 4;

      sum += img[i];
      count++;
    }
  }

  const avg = sum / count;
  bits.push(avg < 128 ? 1 : 0);
}

}

return bits;
}

/**************** FINDER ****************/
function drawFinder(ctx, size){
const s = 40;

function box(x, y){
ctx.fillStyle = "#000";
ctx.fillRect(x, y, s, s);

ctx.fillStyle = "#fff";
ctx.fillRect(x+8, y+8, s-16, s-16);

ctx.fillStyle = "#000";
ctx.fillRect(x+16, y+16, s-32, s-32);

}

box(0,0);
box(size-s,0);
box(0,size-s);
}

/**************** UI ****************/
let lastText = "";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const encodeBtn = document.getElementById("encodeBtn");
const decodeBtn = document.getElementById("decodeBtn");
const exportBtn = document.getElementById("exportBtn");

/**************** ENCODE ****************/
encodeBtn.onclick = async () => {
try{
const file = document.getElementById("docInput").files[0];
if(!file) return alert("اختر ملف");

const key = BigInt(document.getElementById("userKey").value || 0);

let text = await extractText(file);
text = cleanText(text);

if(!text) return alert("لا يوجد نص");

const words = text.split(" ");
const bytes = [];

for(const w of words){
  let C = wordToCode(w) ^ key;

  for(let j=0;j<8;j++){
    bytes.push(Number((C >> BigInt(8*j)) & 0xFFn));
  }
}

const bits = bytesToBits(bytes);

canvas.width = SIZE;
canvas.height = SIZE;

const cells = drawGrid(ctx, bits, SIZE);
drawFinder(ctx, SIZE);

canvas.dataset.cells = cells;

alert("تم التشفير بنجاح");

}catch(e){
console.error(e);
alert(e.message);
}
};

/**************** DECODE ****************/
decodeBtn.onclick = () => {
try{
const key = BigInt(document.getElementById("userKey").value || 0);

const cells = parseInt(canvas.dataset.cells) || 180;

const bits = readGrid(ctx, canvas.width, cells);
const bytes = bitsToBytes(bits);

const words = [];

for(let i=0;i<bytes.length;i+=8){
  let C = 0n;

  for(let j=0;j<8;j++){
    C |= BigInt(bytes[i+j] || 0) << BigInt(8*j);
  }

  const w = codeToWord(C ^ key);
  if(w) words.push(w);
}

lastText = words.join(" ");
document.getElementById("outputText").value = lastText;

}catch(e){
console.error(e);
alert("فشل فك التشفير");
}
};

/**************** EXPORT ****************/
exportBtn.onclick = async () => {
try{
if(!lastText) return alert("لا يوجد نص");

const mode = document.getElementById("exportMode").value;

if(mode === "word"){
  const { Document, Packer, Paragraph } = window.docx;

  const doc = new Document({
    sections: [{ children: [new Paragraph(lastText)] }]
  });

  const blob = await Packer.toBlob(doc);
  download(blob, "decoded.docx");

}else{
  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF();
  const lines = pdf.splitTextToSize(lastText, 180);
  pdf.text(lines, 10, 10);
  pdf.save("decoded.pdf");
}

}catch(e){
console.error(e);
alert("فشل التصدير");
}
};

function download(blob, name){
const a = document.createElement("a");
a.href = URL.createObjectURL(blob);
a.download = name;
a.click();
}
