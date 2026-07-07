// app.js - Main Application Logic (SPA & Web3)

const RPC_URL = "https://api.mainnet-beta.solana.com"; 
const connection = new solanaWeb3.Connection(RPC_URL, 'confirmed');

let currentWalletState = {
    publicKey: null,
    balances: { sol: 0, usd: 0 }
};

// ==========================================
// TOAST NOTIFICATION ENGINE (Premium)
// ==========================================
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `glass-toast toast-${type}`;
    
    let icon = 'fa-circle-info';
    if(type === 'success') icon = 'fa-circle-check';
    if(type === 'error') icon = 'fa-circle-xmark';
    if(type === 'warning') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    // Animasi masuk (Soft intro)
    setTimeout(() => toast.classList.add('show'), 10);

    // Animasi keluar setelah 3 detik
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400); 
    }, 3000);
}


// ==========================================
// FASE 1: ONBOARDING LOGIC
// ==========================================

// Global Route Controller (Kebal terhadap local file system)
window.goToStep = function(stepId) {
    // Jika masuk ke langkah create, paksa trigger fungsi generate!
    if(stepId === 'step-create-1') {
        createNewWallet(); 
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

async function createNewWallet() {
    showToast("Generating secure keys...", "info");
    
    const keypair = solanaWeb3.Keypair.generate();
    const pubKey = keypair.publicKey.toString();
    const secretKeyArray = Array.from(keypair.secretKey);
    const privKeyString = JSON.stringify(secretKeyArray);

    const privKeyDisplay = document.getElementById('privKeyDisplay');
    if(privKeyDisplay) privKeyDisplay.value = privKeyString; 
    
    const seedPhraseGrid = document.getElementById('seedPhraseGrid');
    if (seedPhraseGrid) {
        seedPhraseGrid.innerHTML = ""; 
        const wordList = ["abstract", "bacon", "cabin", "dad", "eagle", "fabric", "gadget", "habit", "ice", "jacket", "kangaroo", "labor", "machine", "narrow", "oasis", "pact", "radar", "sad", "tact", "vacant", "wagon", "yacht", "zebra"];
        
        for(let i = 1; i <= 12; i++) {
            const randomValues = new Uint32Array(1);
            window.crypto.getRandomValues(randomValues);
            const randomIdx = randomValues[0] % wordList.length;
            const word = wordList[randomIdx];
            
            const div = document.createElement('div');
            div.className = 'seed-word';
            div.innerHTML = `<span>${i}</span> ${word}`;
            seedPhraseGrid.appendChild(div);
        }
    }
    
    sessionStorage.setItem('tempPrivKey', privKeyString);
    sessionStorage.setItem('tempPubKey', pubKey);
}

function toggleViewPrivKey() {
    const input = document.getElementById('privKeyDisplay');
    const icon = document.getElementById('eyeIcon');
    if (!input) return;
    
    if (input.type === "password") {
        input.type = "text";
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = "password";
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

function copyPrivKey() {
    const input = document.getElementById('privKeyDisplay');
    if (!input || !input.value) {
        showToast("Private Key is empty!", "error");
        return;
    }
    navigator.clipboard.writeText(input.value).then(() => {
        showToast("Copied to clipboard", "success");
    }).catch(() => {
        showToast("Failed to copy", "error");
    });
}

// Fungsi Download JSON (Keystore)
function downloadKeystore() {
    const privKey = sessionStorage.getItem('tempPrivKey');
    const pubKey = sessionStorage.getItem('tempPubKey');
    
    if(!privKey || !pubKey) {
        showToast("Wallet not generated yet!", "error");
        return;
    }
    
    // Format JSON Wallet Standar
    const keystore = {
        network: "solana",
        publicKey: pubKey,
        privateKey: JSON.parse(privKey)
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(keystore, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `MySolWallet_${pubKey.slice(0,6)}.json`);
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    dlAnchorElem.remove();
    
    showToast("Keystore JSON downloaded successfully!", "success");
}

// Logika Keypad PIN
let enteredPin = "";
document.querySelectorAll('.keypad .key').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const val = e.target.innerText;
        const isDelete = e.target.closest('.key').innerHTML.includes('fa-delete-left');
        const pinDots = document.querySelectorAll('.pin-dot');

        if (isDelete) {
            enteredPin = enteredPin.slice(0, -1);
        } else if (val && enteredPin.length < 8 && !e.target.classList.contains('invisible')) {
            enteredPin += val;
        }

        pinDots.forEach((dot, index) => {
            if (index < enteredPin.length) dot.classList.add('filled');
            else dot.classList.remove('filled');
        });
    });
});

const confirmPinBtn = document.getElementById('confirmPinBtn');
if (confirmPinBtn) {
    confirmPinBtn.addEventListener('click', async () => {
        if (enteredPin.length !== 8) {
            showToast("PIN must be exactly 8 digits.", "warning");
            return;
        }
        confirmPinBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Encrypting...';
        confirmPinBtn.disabled = true;
        await finalizeWalletSetup(enteredPin);
    });
}

async function finalizeWalletSetup(pin) {
    const privKey = sessionStorage.getItem('tempPrivKey');
    const pubKey = sessionStorage.getItem('tempPubKey');

    if (!privKey) {
        showToast("Session expired. Please restart.", "error");
        setTimeout(() => window.location.reload(), 1500);
        return;
    }

    try {
        const encryptedWallet = await CryptoService.encryptData(privKey, pin);
        localStorage.setItem('MySolWallet_Data', encryptedWallet);
        localStorage.setItem('MySolWallet_PubKey', pubKey);
        sessionStorage.removeItem('tempPrivKey');
        
        showToast("Wallet Secured! Logging in...", "success");
        setTimeout(() => window.location.href = 'main.html', 1000);
    } catch (error) {
        showToast("Encryption failed.", "error");
        confirmPinBtn.innerHTML = 'Confirm & Login';
        confirmPinBtn.disabled = false;
    }
}


// ==========================================
// FASE 2: DASHBOARD SPA (main.html logic)
// ==========================================
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

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if(modal) modal.classList.remove('hidden');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if(modal) modal.classList.add('hidden');
}

function openAssetAction(assetStr) {
    if(assetStr === 'SOL') openModal('modal-send');
}

function setMaxAmount() {
    const input = document.getElementById('sendAmount');
    if(input) input.value = currentWalletState.balances.sol;
}

function openConfirmModal() {
    const address = document.getElementById('sendAddress').value;
    const amount = document.getElementById('sendAmount').value;

    if(!address || !amount || amount <= 0) {
        showToast("Valid address & amount required", "warning");
        return;
    }
    document.getElementById('confirmAddress').innerText = address;
    document.getElementById('confirmAmount').innerText = `${amount} SOL`;
    closeModal('modal-send');
    openModal('modal-confirm');
}

function openPinModal() {
    closeModal('modal-confirm');
    openModal('modal-pin-tx');
    enteredPin = ""; 
    document.querySelectorAll('#modal-pin-tx .pin-dot').forEach(dot => dot.classList.remove('filled'));
}

async function initDashboard() {
    const savedPubKey = localStorage.getItem('MySolWallet_PubKey');
    if (!savedPubKey) return;

    currentWalletState.publicKey = savedPubKey;
    const shortAddr = `${savedPubKey.slice(0, 4)}...${savedPubKey.slice(-4)}`;
    const addrEl = document.getElementById('shortAddress');
    if(addrEl) addrEl.innerText = shortAddr;

    await fetchBalances(savedPubKey);
}

async function fetchBalances(pubKeyStr) {
    try {
        const pubKey = new solanaWeb3.PublicKey(pubKeyStr);
        const lamports = await connection.getBalance(pubKey);
        const solBalance = lamports / solanaWeb3.LAMPORTS_PER_SOL;
        
        currentWalletState.balances.sol = solBalance; 
        const maxSolEl = document.getElementById('maxSol');
        if(maxSolEl) maxSolEl.innerText = solBalance.toFixed(4);

        const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const priceData = await priceRes.json();
        const solPriceUsd = priceData.solana.usd;
        const totalUsdValue = solBalance * solPriceUsd;

        if(document.getElementById('solBalance')) {
            document.getElementById('solBalance').innerText = `${solBalance.toFixed(4)} SOL`;
            document.getElementById('solUsdValue').innerText = `$${totalUsdValue.toFixed(2)}`;
            document.getElementById('totalUsdBalance').innerText = `$${totalUsdValue.toFixed(2)}`;
        }
    } catch (error) {
        console.error("Gagal mengambil data:", error);
    }
}

async function executeTransaction(pinEntered) {
    const destinationAddress = document.getElementById('sendAddress').value;
    const amountSol = parseFloat(document.getElementById('sendAmount').value);

    try {
        showToast("Decrypting & Signing...", "info");
        const encryptedData = localStorage.getItem('MySolWallet_Data');
        const decryptedPrivKeyStr = await CryptoService.decryptData(encryptedData, pinEntered);
        
        if (!decryptedPrivKeyStr) {
            showToast("Incorrect PIN!", "error");
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

        const signature = await solanaWeb3.sendAndConfirmTransaction(
            connection,
            transaction,
            [senderKeypair] 
        );

        showToast("Transaction Success!", "success");
        closeModal('modal-pin-tx');
        fetchBalances(senderKeypair.publicKey.toString()); 
        
        document.getElementById('sendAddress').value = "";
        document.getElementById('sendAmount').value = "";

    } catch (error) {
        showToast("Transaction Failed. Check balance.", "error");
    }
}

if (window.location.pathname.includes('main.html')) {
    window.onload = initDashboard;
        }
