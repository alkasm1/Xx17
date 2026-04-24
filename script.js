/* ===== Crypto ===== */

async function deriveKey(password, salt) {
const enc = new TextEncoder();

const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
);

return crypto.subtle.deriveKey(
    {
        name: "PBKDF2",
        salt,
        iterations: 100000,
        hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
);

}

async function compress(data) {
const cs = new CompressionStream("gzip");
const writer = cs.writable.getWriter();
writer.write(data);
writer.close();
return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

async function decompress(data) {
const ds = new DecompressionStream("gzip");
const writer = ds.writable.getWriter();
writer.write(data);
writer.close();
return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

async function encryptData(text, password) {
const enc = new TextEncoder();

const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));

const key = await deriveKey(password, salt);

const compressed = await compress(enc.encode(text));

const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    compressed
);

return {
    salt,
    iv,
    data: new Uint8Array(cipher)
};

}

async function decryptData(packet, password) {
const key = await deriveKey(password, packet.salt);

const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: packet.iv },
    key,
    packet.data
);

const decompressed = await decompress(new Uint8Array(decrypted));

return new TextDecoder().decode(decompressed);

}

/* ===== Packet ===== */

function buildPacket(enc) {
const header = new Uint8Array(38);

header.set([65,76,77,49],0); // ALM1
header[4]=1;
header[5]=1;

header.set(enc.salt,6);
header.set(enc.iv,22);

const len = enc.data.length;
header[34]=(len>>24)&255;
header[35]=(len>>16)&255;
header[36]=(len>>8)&255;
header[37]=len&255;

return new Uint8Array([...header,...enc.data]);

}

/* ===== Image Encode ===== */

function encodeToImage(data, canvas) {
const repeat = 3;

const total = data.length * repeat;
const pixels = Math.ceil(total / 3);
const size = Math.ceil(Math.sqrt(pixels));

canvas.width = size;
canvas.height = size;

const ctx = canvas.getContext("2d");
const img = ctx.createImageData(size,size);

let ptr=0;

for(let i=0;i<data.length;i++){
    for(let r=0;r<repeat;r++){
        const idx=ptr*4;

        const b=data[i];

        img.data[idx]=b;
        img.data[idx+1]=b^0xaa;
        img.data[idx+2]=b^0x55;
        img.data[idx+3]=255;

        ptr++;
    }
}

ctx.putImageData(img,0,0);

}

/* ===== Image Decode ===== */

function decodeFromImage(canvas){
const ctx=canvas.getContext("2d");
const img=ctx.getImageData(0,0,canvas.width,canvas.height);

const repeat=3;
const bytes=[];

for(let i=0;i<img.data.length;i+=4*repeat){
    const vals=[];

    for(let r=0;r<repeat;r++){
        const idx=i+r*4;
        const b=img.data[idx];

        if(
            img.data[idx+1]===(b^0xaa) &&
            img.data[idx+2]===(b^0x55)
        ){
            vals.push(b);
        }
    }

    if(vals.length){
        const avg=vals.reduce((a,b)=>a+b)/vals.length;
        bytes.push(Math.round(avg));
    }
}

return new Uint8Array(bytes);

}

/* ===== UI ===== */

const canvas=document.getElementById("canvas");
const inputText=document.getElementById("inputText");
const outputText=document.getElementById("outputText");
const password=document.getElementById("password");

document.getElementById("encodeBtn").onclick=async ()=>{
const text=inputText.value;
const pass=password.value;

const enc=await encryptData(text,pass);
const packet=buildPacket(enc);

encodeToImage(packet,canvas);

};

document.getElementById("decodeBtn").onclick=async ()=>{
const pass=password.value;

const bytes=decodeFromImage(canvas);

if(bytes[0]!==65||bytes[1]!==76||bytes[2]!==77||bytes[3]!==49){
    alert("الصورة غير صالحة");
    return;
}

const salt=bytes.slice(6,22);
const iv=bytes.slice(22,34);

const len=
    (bytes[34]<<24)|
    (bytes[35]<<16)|
    (bytes[36]<<8)|
    bytes[37];

const data=bytes.slice(38,38+len);

const text=await decryptData({salt,iv,data},pass);

outputText.value=text;

};

/* تحميل صورة */
document.getElementById("imageInput").onchange=e=>{
const file=e.target.files[0];
if(!file)return;

const img=new Image();
img.onload=()=>{
    const ctx=canvas.getContext("2d");
    canvas.width=img.width;
    canvas.height=img.height;
    ctx.drawImage(img,0,0);
};

img.src=URL.createObjectURL(file);

};
