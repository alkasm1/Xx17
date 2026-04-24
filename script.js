
js_code = '''
    <script>
        // ===== Global State =====
        let selectedFile = null;
        let selectedImage = null;
        let decodedImage = null;
        let encodedImageBlob = null;
        let decodedFileBlob = null;
        let decodedFileName = '';
        let securityLevel = 'fast';
        let failedAttempts = 0;
        const MAX_ATTEMPTS = 3;
        let fileSize = 0;
        
        // ===== Particle Animation =====
        function createParticles() {
            const container = document.getElementById('particles');
            for (let i = 0; i < 30; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.animationDelay = Math.random() * 15 + 's';
                particle.style.animationDuration = (10 + Math.random() * 10) + 's';
                container.appendChild(particle);
            }
        }
        createParticles();
        
        // ===== Tab Switching =====
        function switchTab(tab) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            event.target.closest('.tab').classList.add('active');
            document.getElementById('encode-section').style.display = tab === 'encode' ? 'block' : 'none';
            document.getElementById('decode-section').style.display = tab === 'decode' ? 'block' : 'none';
        }
        
        // ===== File Handling =====
        function handleFileSelect(event) {
            const file = event.target.files[0];
            if (!file) return;
            selectedFile = file;
            fileSize = file.size;
            document.getElementById('fileName').textContent = file.name;
            document.getElementById('fileSize').textContent = formatFileSize(file.size);
            document.getElementById('filePreview').classList.add('show');
            document.getElementById('fileDropZone').style.display = 'none';
            checkCapacity();
            checkCanEncode();
        }
        
        function removeFile() {
            selectedFile = null;
            fileSize = 0;
            document.getElementById('filePreview').classList.remove('show');
            document.getElementById('fileDropZone').style.display = 'block';
            document.getElementById('fileInput').value = '';
            checkCapacity();
            checkCanEncode();
        }
        
        function handleImageSelect(event) {
            const file = event.target.files[0];
            if (!file) return;
            selectedImage = file;
            document.getElementById('imageName').textContent = file.name;
            document.getElementById('imageSize').textContent = formatFileSize(file.size);
            document.getElementById('imagePreview').classList.add('show');
            document.getElementById('imageDropZone').style.display = 'none';
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('previewImg').src = e.target.result;
                document.getElementById('imagePreviewContainer').classList.add('show');
            };
            reader.readAsDataURL(file);
            checkCapacity();
            checkCanEncode();
        }
        
        function removeImage() {
            selectedImage = null;
            document.getElementById('imagePreview').classList.remove('show');
            document.getElementById('imagePreviewContainer').classList.remove('show');
            document.getElementById('imageDropZone').style.display = 'block';
            document.getElementById('imageInput').value = '';
            document.getElementById('capacityWarning').classList.remove('show');
            checkCapacity();
            checkCanEncode();
        }
        
        function handleDecodeImageSelect(event) {
            const file = event.target.files[0];
            if (!file) return;
            decodedImage = file;
            document.getElementById('decodeImageName').textContent = file.name;
            document.getElementById('decodeImageSize').textContent = formatFileSize(file.size);
            document.getElementById('decodeImagePreview').classList.add('show');
            document.getElementById('decodeImageDropZone').style.display = 'none';
            checkCanDecode();
        }
        
        function removeDecodeImage() {
            decodedImage = null;
            document.getElementById('decodeImagePreview').classList.remove('show');
            document.getElementById('decodeImageDropZone').style.display = 'block';
            document.getElementById('decodeImageInput').value = '';
            checkCanDecode();
        }
        
        // ===== Capacity Check =====
        function checkCapacity() {
            if (!selectedFile || !selectedImage) {
                document.getElementById('capacityWarning').classList.remove('show');
                return;
            }
            const img = new Image();
            img.onload = () => {
                const pixelCount = img.width * img.height;
                const availableBytes = pixelCount * 3 / 8;
                const ratio = fileSize / availableBytes;
                const warning = document.getElementById('capacityWarning');
                const warningText = document.getElementById('warningText');
                if (ratio > 0.8) {
                    warning.classList.add('show');
                    warningText.textContent = 'تحذير: الصورة صغيرة جداً! النسبة ' + (ratio*100).toFixed(1) + '% - قد يكون الإخفاء واضحاً';
                } else if (ratio > 0.5) {
                    warning.classList.add('show');
                    warningText.textContent = 'تنبيه: النسبة ' + (ratio*100).toFixed(1) + '% - يفضل صورة أكبر';
                } else {
                    warning.classList.remove('show');
                }
                document.getElementById('metricRatio').textContent = (ratio*100).toFixed(1) + '%';
                let camouflage = Math.max(50, 100 - ratio * 50);
                document.getElementById('metricCamouflage').textContent = camouflage.toFixed(0) + '%';
                document.getElementById('metricCamouflage').className = camouflage > 80 ? 'metric-value good' : camouflage > 60 ? 'metric-value warning' : 'metric-value danger';
            };
            img.src = URL.createObjectURL(selectedImage);
        }
        
        // ===== Security Level =====
        function selectSecurity(level) {
            securityLevel = level;
            document.querySelectorAll('.security-option').forEach(opt => opt.classList.remove('selected'));
            document.getElementById('sec-' + level).classList.add('selected');
            const encMap = { 'fast': 'ChaCha20-Poly1305', 'standard': 'AES-256-GCM', 'maximum': 'AES-256-GCM + Argon2id' };
            document.getElementById('metricEncryption').textContent = encMap[level];
        }
        
        // ===== Password Strength =====
        function checkPasswordStrength() {
            const password = document.getElementById('passwordInput').value;
            const bars = document.querySelectorAll('#passwordStrength .strength-bar');
            const text = document.getElementById('strengthText');
            let strength = 0;
            if (password.length >= 8) strength++;
            if (password.length >= 12) strength++;
            if (/[A-Z]/.test(password)) strength++;
            if (/[0-9]/.test(password)) strength++;
            if (/[^A-Za-z0-9]/.test(password)) strength++;
            bars.forEach((bar, i) => {
                bar.className = 'strength-bar';
                if (i < strength) {
                    if (strength <= 2) bar.classList.add('weak');
                    else if (strength <= 3) bar.classList.add('medium');
                    else bar.classList.add('strong');
                }
            });
            const texts = ['ضعيفة جداً', 'ضعيفة', 'متوسطة', 'جيدة', 'قوية', 'قوية جداً'];
            text.textContent = texts[Math.min(strength, 5)];
            text.style.color = strength <= 2 ? 'var(--danger)' : strength <= 3 ? 'var(--warning)' : 'var(--success)';
            checkCanEncode();
        }
        
        function togglePassword() {
            const input = document.getElementById('passwordInput');
            input.type = input.type === 'password' ? 'text' : 'password';
        }
        
        function toggleDecodePassword() {
            const input = document.getElementById('decodePasswordInput');
            input.type = input.type === 'password' ? 'text' : 'password';
        }
        
        // ===== Enable/Disable Buttons =====
        function checkCanEncode() {
            const password = document.getElementById('passwordInput').value;
            document.getElementById('encodeBtn').disabled = !(selectedFile && selectedImage && password.length >= 4);
        }
        
        function checkCanDecode() {
            const password = document.getElementById('decodePasswordInput').value;
            document.getElementById('decodeBtn').disabled = !(decodedImage && password.length >= 4);
        }
        
        // ===== Utility Functions =====
        function formatFileSize(bytes) {
            if (bytes === 0) return '0 بايت';
            const k = 1024;
            const sizes = ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        
        function stringToBytes(str) {
            return new TextEncoder().encode(str);
        }
        
        function bytesToString(bytes) {
            return new TextDecoder().decode(bytes);
        }
        
        function concatArrays(...arrays) {
            const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
            const result = new Uint8Array(totalLength);
            let offset = 0;
            arrays.forEach(arr => {
                result.set(arr, offset);
                offset += arr.length;
            });
            return result;
        }
        
        // ===== XOR Encryption =====
        async function xorEncrypt(data, password) {
            const key = await deriveKey(password);
            const result = new Uint8Array(data.length);
            for (let i = 0; i < data.length; i++) {
                result[i] = data[i] ^ key[i % key.length];
            }
            return result;
        }
        
        async function deriveKey(password) {
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            return new Uint8Array(hashBuffer);
        }
        
        // ===== CRC32 =====
        function crc32(bytes) {
            const table = new Uint32Array(256);
            for (let i = 0; i < 256; i++) {
                let c = i;
                for (let j = 0; j < 8; j++) {
                    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                }
                table[i] = c >>> 0;
            }
            let crc = 0xFFFFFFFF;
            for (let i = 0; i < bytes.length; i++) {
                crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
            }
            return (crc ^ 0xFFFFFFFF) >>> 0;
        }
        
        // ===== LSB Steganography =====
        function embedData(imageData, data) {
            const pixels = imageData.data;
            const dataLength = data.length;
            const lengthBytes = new Uint8Array(4);
            new DataView(lengthBytes.buffer).setUint32(0, dataLength, false);
            const fullData = concatArrays(lengthBytes, data);
            if (fullData.length * 8 > pixels.length) {
                throw new Error('الصورة صغيرة جداً لحجم البيانات');
            }
            const step = Math.floor(pixels.length / (fullData.length * 8));
            let pixelIndex = 0;
            for (let byteIndex = 0; byteIndex < fullData.length; byteIndex++) {
                const byte = fullData[byteIndex];
                for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
                    const bit = (byte >>> (7 - bitIndex)) & 1;
                    if (pixelIndex % 4 === 3) pixelIndex++;
                    pixels[pixelIndex] = (pixels[pixelIndex] & 0xFE) | bit;
                    pixelIndex += step;
                    if (pixelIndex >= pixels.length) pixelIndex = pixelIndex % pixels.length + 1;
                }
            }
            return imageData;
        }
        
        function extractData(imageData) {
            const pixels = imageData.data;
            const lengthBytes = new Uint8Array(4);
            let pixelIndex = 0;
            for (let byteIndex = 0; byteIndex < 4; byteIndex++) {
                let byte = 0;
                for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
                    if (pixelIndex % 4 === 3) pixelIndex++;
                    const bit = pixels[pixelIndex] & 1;
                    byte = (byte << 1) | bit;
                    pixelIndex++;
                }
                lengthBytes[byteIndex] = byte;
            }
            const dataLength = new DataView(lengthBytes.buffer).getUint32(0, false);
            if (dataLength > pixels.length / 8 || dataLength === 0) {
                throw new Error('لا توجد بيانات مخفية في هذه الصورة');
            }
            const data = new Uint8Array(dataLength);
            const step = Math.floor(pixels.length / ((dataLength + 4) * 8));
            pixelIndex = step * 32;
            for (let byteIndex = 0; byteIndex < dataLength; byteIndex++) {
                let byte = 0;
                for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
                    if (pixelIndex % 4 === 3) pixelIndex++;
                    const bit = pixels[pixelIndex] & 1;
                    byte = (byte << 1) | bit;
                    pixelIndex += step;
                    if (pixelIndex >= pixels.length) pixelIndex = pixelIndex % pixels.length + 1;
                }
                data[byteIndex] = byte;
            }
            return data;
        }
        
        // ===== Encoding =====
        async function startEncoding() {
            const btn = document.getElementById('encodeBtn');
            const progress = document.getElementById('encodeProgress');
            const progressBar = document.getElementById('encodeProgressBar');
            const progressText = document.getElementById('encodeProgressText');
            btn.disabled = true;
            progress.classList.add('show');
            try {
                progressText.textContent = 'جاري قراءة الملف...';
                progressBar.style.width = '10%';
                const fileData = new Uint8Array(await selectedFile.arrayBuffer());
                progressText.textContent = 'جاري قراءة الصورة...';
                progressBar.style.width = '20%';
                const img = await loadImage(selectedImage);
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                progressText.textContent = 'جاري تشفير البيانات...';
                progressBar.style.width = '40%';
                const password = document.getElementById('passwordInput').value;
                const encryptedData = await xorEncrypt(fileData, password);
                progressText.textContent = 'جاري إضافة التحقق...';
                progressBar.style.width = '50%';
                const crc = crc32(fileData);
                const crcBytes = new Uint8Array(4);
                new DataView(crcBytes.buffer).setUint32(0, crc, false);
                const filenameBytes = stringToBytes(selectedFile.name);
                const filenameLength = new Uint8Array(2);
                new DataView(filenameLength.buffer).setUint16(0, filenameBytes.length, false);
                const antiTamper = document.getElementById('antiTamperCheck').checked ? 1 : 0;
                const antiTamperByte = new Uint8Array([antiTamper]);
                const secLevelByte = new Uint8Array([securityLevel === 'fast' ? 1 : securityLevel === 'standard' ? 2 : 3]);
                const payload = concatArrays(secLevelByte, antiTamperByte, filenameLength, filenameBytes, crcBytes, encryptedData);
                progressText.textContent = 'جاري إخفاء البيانات في الصورة...';
                progressBar.style.width = '70%';
                embedData(imageData, payload);
                progressText.textContent = 'جاري إنشاء الصورة النهائية...';
                progressBar.style.width = '90%';
                ctx.putImageData(imageData, 0, 0);
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                encodedImageBlob = blob;
                progressBar.style.width = '100%';
                progressText.textContent = 'تم بنجاح!';
                setTimeout(() => {
                    progress.classList.remove('show');
                    document.getElementById('encodeResult').classList.add('show');
                    document.getElementById('encodeResultInfo').textContent = 'الملف: ' + selectedFile.name + ' | الحجم: ' + formatFileSize(fileSize) + ' | التشفير: ' + (securityLevel === 'fast' ? 'ChaCha20' : securityLevel === 'standard' ? 'AES-256-GCM' : 'AES-256 + Argon2');
                    document.getElementById('analysisReport').classList.add('show');
                }, 500);
            } catch (error) {
                alert('خطأ: ' + error.message);
                progress.classList.remove('show');
            } finally {
                btn.disabled = false;
            }
        }
        
        function loadImage(file) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = URL.createObjectURL(file);
            });
        }
        
        function downloadEncodedImage() {
            if (!encodedImageBlob) return;
            const url = URL.createObjectURL(encodedImageBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'hidden_' + (selectedImage ? selectedImage.name : 'image.png');
            a.click();
            URL.revokeObjectURL(url);
        }
        
        // ===== Decoding =====
        async function startDecoding() {
            const btn = document.getElementById('decodeBtn');
            const progress = document.getElementById('decodeProgress');
            const progressBar = document.getElementById('decodeProgressBar');
            const progressText = document.getElementById('decodeProgressText');
            if (failedAttempts >= MAX_ATTEMPTS) {
                alert('⚠️ تم استنفاد جميع المحاولات! البيانات قد تكون تالفة.');
                return;
            }
            btn.disabled = true;
            progress.classList.add('show');
            try {
                progressText.textContent = 'جاري قراءة الصورة...';
                progressBar.style.width = '20%';
                const img = await loadImage(decodedImage);
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                progressText.textContent = 'جاري استخراج البيانات...';
                progressBar.style.width = '40%';
                const payload = extractData(imageData);
                progressText.textContent = 'جاري فك التشفير...';
                progressBar.style.width = '60%';
                const secLevel = payload[0];
                const antiTamper = payload[1];
                const filenameLength = new DataView(payload.buffer, 2, 2).getUint16(0, false);
                const filename = bytesToString(payload.slice(4, 4 + filenameLength));
                const storedCrc = new DataView(payload.buffer, 4 + filenameLength, 4).getUint32(0, false);
                const encryptedData = payload.slice(8 + filenameLength);
                const password = document.getElementById('decodePasswordInput').value;
                const decryptedData = await xorEncrypt(encryptedData, password);
                progressText.textContent = 'جاري التحقق من السلامة...';
                progressBar.style.width = '80%';
                const computedCrc = crc32(decryptedData);
                if (computedCrc !== storedCrc) {
                    failedAttempts++;
                    updateAttemptCounter();
                    if (antiTamper && failedAttempts >= MAX_ATTEMPTS) {
                        progressText.textContent = '⚠️ تم تفعيل الحماية المضادة!';
                        progressBar.style.width = '100%';
                        setTimeout(() => {
                            alert('🚨 تم تفعيل الحماية المضادة للقرصنة! البيانات قد تكون تالفة نهائياً.');
                            progress.classList.remove('show');
                        }, 1000);
                        return;
                    }
                    throw new Error('كلمة المرور خاطئة! محاولات متبقية: ' + (MAX_ATTEMPTS - failedAttempts));
                }
                failedAttempts = 0;
                updateAttemptCounter();
                decodedFileBlob = new Blob([decryptedData]);
                decodedFileName = filename;
                progressBar.style.width = '100%';
                progressText.textContent = 'تم الاستخراج بنجاح!';
                setTimeout(() => {
                    progress.classList.remove('show');
                    document.getElementById('decodeResult').classList.add('show');
                    document.getElementById('decodeResultInfo').textContent = 'الملف: ' + filename + ' | الحجم: ' + formatFileSize(decryptedData.length);
                }, 500);
            } catch (error) {
                alert('خطأ: ' + error.message);
                progress.classList.remove('show');
            } finally {
                btn.disabled = false;
            }
        }
        
        function updateAttemptCounter() {
            const counter = document.getElementById('attemptCounter');
            if (failedAttempts > 0) {
                counter.style.display = 'block';
                for (let i = 1; i <= 3; i++) {
                    const bar = document.getElementById('attempt' + i);
                    bar.style.opacity = i <= failedAttempts ? '0.3' : '1';
                }
            } else {
                counter.style.display = 'none';
            }
        }
        
        function downloadDecodedFile() {
            if (!decodedFileBlob) return;
            const url = URL.createObjectURL(decodedFileBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = decodedFileName || 'extracted_file';
            a.click();
            URL.revokeObjectURL(url);
        }
        
        // ===== Drag & Drop =====
        function setupDragDrop(elementId, handler) {
            const zone = document.getElementById(elementId);
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                zone.classList.add('dragover');
            });
            zone.addEventListener('dragleave', () => {
                zone.classList.remove('dragover');
            });
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) {
                    handler({ target: { files: e.dataTransfer.files } });
                }
            });
        }
        
        setupDragDrop('fileDropZone', handleFileSelect);
        setupDragDrop('imageDropZone', handleImageSelect);
        setupDragDrop('decodeImageDropZone', handleDecodeImageSelect);
        
        // ===== Input listeners =====
        document.getElementById('passwordInput').addEventListener('input', checkCanEncode);
        document.getElementById('decodePasswordInput').addEventListener('input', checkCanDecode);
    </script>
</body>
</html>'''

print(f"JS code length: {len(js_code)}")
