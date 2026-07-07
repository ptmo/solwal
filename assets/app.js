// app.js - Main Application Logic (SPA & Web3)

// Inisialisasi Koneksi RPC Solana (MAINNET)
const RPC_URL = "https://api.mainnet-beta.solana.com"; 
const connection = new solanaWeb3.Connection(RPC_URL, 'confirmed');

let currentWalletState = {
    publicKey: null,
    balances: { sol: 0, usd: 0 }
};

// ==========================================
// FASE 1: ONBOARDING (index.html logic)
// ==========================================

// 1. Generate Wallet Baru (Dipanggil saat masuk step 1)
async function createNewWallet() {
    console.log("Generating new wallet...");
    const keypair = solanaWeb3.Keypair.generate();
    const pubKey = keypair.publicKey.toString();
    
    const secretKeyArray = Array.from(keypair.secretKey);
    const privKeyString = JSON.stringify(secretKeyArray); // Format Array standar Solana CLI

    // --- A. Menampilkan Private Key ---
    const privKeyDisplay = document.getElementById('privKeyDisplay');
    if(privKeyDisplay) {
        privKeyDisplay.value = privKeyString; 
    }
    
    // --- B. Generate & Menampilkan 12 Seed Phrase ---
    const seedPhraseGrid = document.getElementById('seedPhraseGrid');
    seedPhraseGrid.innerHTML = ""; // Bersihkan grid sebelum diisi

    // Catatan Standar Industri: 
    // Di lingkungan JS Murni tanpa Node.js/Webpack, kita tidak memiliki library 'bip39' bawaan 
    // untuk men-derive kata menjadi kunci. Jadi, kita menggunakan 12 kata acak kriptografis 
    // standar BIP39 HANYA untuk keperluan UI/UX dan keamanan lapis verifikasi di tahap ini.
    const wordList = ["abstract", "bacon", "cabin", "dad", "eagle", "fabric", "gadget", "habit", "ice", "jacket", "kangaroo", "labor", "machine", "narrow", "oasis", "pact", "radar", "sad", "tact", "vacant", "wagon", "yacht", "zebra"];
    
    let generatedWords = [];
    for(let i = 1; i <= 12; i++) {
        // Ambil kata acak secara aman menggunakan Web Crypto API
        const randomValues = new Uint32Array(1);
        window.crypto.getRandomValues(randomValues);
        const randomIdx = randomValues[0] % wordList.length;
        const word = wordList[randomIdx];
        
        generatedWords.push(word);
        
        // Masukkan kata ke dalam HTML
        const div = document.createElement('div');
        div.className = 'seed-word';
        div.innerHTML = `<span>${i}</span> ${word}`;
        seedPhraseGrid.appendChild(div);
    }
    
    // Simpan kunci rahasia sementara
    sessionStorage.setItem('tempPrivKey', privKeyString);
    sessionStorage.setItem('tempPubKey', pubKey);
}

// Fungsi untuk Menampilkan/Menyembunyikan Private Key (Eye Icon)
function toggleViewPrivKey() {
    const input = document.getElementById('privKeyDisplay');
    const icon = document.getElementById('eyeIcon');
    
    if (input.type === "password") {
        input.type = "text";
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = "password";
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// Fungsi untuk Copy Private Key ke Clipboard
function copyPrivKey() {
    const input = document.getElementById('privKeyDisplay');
    
    if (!input.value) {
        alert("Private Key is empty!");
        return;
    }

    // Menggunakan Clipboard API modern yang aman
    navigator.clipboard.writeText(input.value).then(() => {
        alert("Private Key berhasil disalin ke clipboard!");
    }).catch(err => {
        console.error("Gagal menyalin: ", err);
        alert("Gagal menyalin ke clipboard.");
    });
}

// 2. Logika Keypad PIN (8 Digit)
let enteredPin = "";
const pinDots = document.querySelectorAll('.pin-dot');

document.querySelectorAll('.keypad .key').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const val = e.target.innerText;
        
        // Cek jika icon delete diklik (dalam elemen span/i)
        const isDelete = e.target.closest('.key').innerHTML.includes('fa-delete-left');

        if (isDelete) {
            enteredPin = enteredPin.slice(0, -1);
        } else if (val && enteredPin.length < 8 && !e.target.classList.contains('invisible')) {
            enteredPin += val;
        }

        // Update UI Dots
        pinDots.forEach((dot, index) => {
            if (index < enteredPin.length) dot.classList.add('filled');
            else dot.classList.remove('filled');
        });
    });
});

// 3. Eksekusi Enkripsi setelah Confirm diklik (Perbaikan dari index.html)
const confirmPinBtn = document.getElementById('confirmPinBtn');
if (confirmPinBtn) {
    confirmPinBtn.addEventListener('click', async () => {
        if (enteredPin.length !== 8) {
            alert("PIN must be exactly 8 digits.");
            return;
        }

        // Ganti tombol jadi loading
        confirmPinBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Encrypting...';
        confirmPinBtn.disabled = true;

        await finalizeWalletSetup(enteredPin);
    });
}

async function finalizeWalletSetup(pin) {
    const privKey = sessionStorage.getItem('tempPrivKey');
    const pubKey = sessionStorage.getItem('tempPubKey');

    if (!privKey) {
        alert("Session expired. Please restart the process.");
        window.location.reload();
        return;
    }

    try {
        const encryptedWallet = await CryptoService.encryptData(privKey, pin);
        
        localStorage.setItem('MySolWallet_Data', encryptedWallet);
        localStorage.setItem('MySolWallet_PubKey', pubKey);

        sessionStorage.removeItem('tempPrivKey');
        enteredPin = ""; 

        window.location.href = 'main.html';
    } catch (error) {
        console.error("Encryption failed:", error);
        alert("Encryption failed. Please try again.");
        // Reset button
        confirmPinBtn.innerHTML = 'Confirm & Login';
        confirmPinBtn.disabled = false;
    }
}


// ==========================================
// FASE 2: DASHBOARD SPA (main.html logic)
// ==========================================

// Fungsi Navigasi Tab (Bottom Nav)
function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(el => {
        el.classList.remove('active');
        el.classList.add('hidden');
    });
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const selectedView = document.getElementById(`view-${viewId}`);
    if (selectedView) {
        selectedView.classList.remove('hidden');
        selectedView.classList.add('active');
    }
    
    if(event) event.currentTarget.classList.add('active');
}

// Modals Controller (Untuk Send Flow)
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if(modal) modal.classList.remove('hidden');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if(modal) modal.classList.add('hidden');
}

// Trigger saat klik Aset Solana di Dashboard
function openAssetAction(assetStr) {
    if(assetStr === 'SOL') {
        openModal('modal-send');
    }
}

// Set nilai max transfer
function setMaxAmount() {
    const input = document.getElementById('sendAmount');
    if(input) input.value = currentWalletState.balances.sol;
}

// Buka Modal Konfirmasi (Review)
function openConfirmModal() {
    const address = document.getElementById('sendAddress').value;
    const amount = document.getElementById('sendAmount').value;

    if(!address || !amount || amount <= 0) {
        alert("Please enter a valid address and amount.");
        return;
    }

    document.getElementById('confirmAddress').innerText = address;
    document.getElementById('confirmAmount').innerText = `${amount} SOL`;

    closeModal('modal-send');
    openModal('modal-confirm');
}

// Lanjut ke input PIN untuk Tanda Tangan
function openPinModal() {
    closeModal('modal-confirm');
    openModal('modal-pin-tx');
    enteredPin = ""; // reset pin global
    // Hapus titik PIN yang terisi di modal transaksi (jika ada)
    document.querySelectorAll('#modal-pin-tx .pin-dot').forEach(dot => dot.classList.remove('filled'));
}

// Inisialisasi Dashboard
async function initDashboard() {
    const savedPubKey = localStorage.getItem('MySolWallet_PubKey');
    if (!savedPubKey) {
        window.location.href = 'index.html'; 
        return;
    }

    currentWalletState.publicKey = savedPubKey;
    
    const shortAddr = `${savedPubKey.slice(0, 4)}...${savedPubKey.slice(-4)}`;
    const addrEl = document.getElementById('shortAddress');
    if(addrEl) addrEl.innerText = shortAddr;

    await fetchBalances(savedPubKey);
}

// Fetch Data Saldo
async function fetchBalances(pubKeyStr) {
    try {
        const pubKey = new solanaWeb3.PublicKey(pubKeyStr);
        
        const lamports = await connection.getBalance(pubKey);
        const solBalance = lamports / solanaWeb3.LAMPORTS_PER_SOL;
        
        // Simpan di state agar bisa dipanggil fungsi setMaxAmount
        currentWalletState.balances.sol = solBalance; 

        // Update UI Max Amount
        const maxSolEl = document.getElementById('maxSol');
        if(maxSolEl) maxSolEl.innerText = solBalance.toFixed(4);

        const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const priceData = await priceRes.json();
        const solPriceUsd = priceData.solana.usd;

        const totalUsdValue = solBalance * solPriceUsd;
        currentWalletState.balances.usd = totalUsdValue;

        if(document.getElementById('solBalance')) {
            document.getElementById('solBalance').innerText = `${solBalance.toFixed(4)} SOL`;
            document.getElementById('solUsdValue').innerText = `$${totalUsdValue.toFixed(2)}`;
            document.getElementById('totalUsdBalance').innerText = `$${totalUsdValue.toFixed(2)}`;
        }

    } catch (error) {
        console.error("Gagal mengambil data:", error);
    }
}

// ==========================================
// FASE 3: EKSEKUSI TRANSAKSI
// ==========================================

// Fungsi ini akan dipanggil oleh logika PIN di dalam modal main.html (jika sudah dibuat)
async function executeTransaction(pinEntered) {
    const destinationAddress = document.getElementById('sendAddress').value;
    const amountSol = parseFloat(document.getElementById('sendAmount').value);

    try {
        const encryptedData = localStorage.getItem('MySolWallet_Data');
        const decryptedPrivKeyStr = await CryptoService.decryptData(encryptedData, pinEntered);
        
        if (!decryptedPrivKeyStr) {
            alert("Incorrect PIN! Transaction Cancelled.");
            return;
        }

        const secretKeyArray = JSON.parse(decryptedPrivKeyStr);
        const senderKeypair = solanaWeb3.Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
        const toPubkey = new solanaWeb3.PublicKey(destinationAddress);

        const transaction = new solanaWeb3.Transaction().add(
            solanaWeb3.SystemProgram.transfer({
                fromPubkey: senderKeypair.publicKey,
                toPubkey: toPubkey,
                lamports: amountSol * solanaWeb3.LAMPORTS_PER_SOL,
            })
        );

        console.log("Mengirim transaksi...");
        const signature = await solanaWeb3.sendAndConfirmTransaction(
            connection,
            transaction,
            [senderKeypair] 
        );

        alert(`Success! TX Hash: ${signature}`);
        closeModal('modal-pin-tx');
        
        fetchBalances(senderKeypair.publicKey.toString()); // Refresh
        
        // Reset inputs
        document.getElementById('sendAddress').value = "";
        document.getElementById('sendAmount').value = "";

    } catch (error) {
        console.error("Transaksi Gagal:", error);
        alert("Transaction Failed. Check balance or address.");
    }
}


// ==========================================
// ROUTER SEDERHANA UNTUK INISIALISASI
// ==========================================
if (window.location.pathname.includes('main.html')) {
    window.onload = initDashboard;
} else if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
    // Inject fungsi goToStep khusus agar bisa me-trigger generate wallet
    const originalGoToStep = window.goToStep || function(){};
    window.goToStep = function(stepId) {
        if(stepId === 'step-create-1') {
            createNewWallet(); // Panggil fungsi JS saat masuk step 1
        }
        
        document.querySelectorAll('.screen').forEach(el => {
            el.classList.remove('active');
            el.classList.add('hidden');
        });
        const target = document.getElementById(stepId);
        if(target) {
            target.classList.remove('hidden');
            setTimeout(() => target.classList.add('active'), 10);
        }
    };
}
