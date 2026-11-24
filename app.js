
const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const RX_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const TX_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

let device = null;
let server = null;
let tx = null;
let rx = null;

const statusElement = document.getElementById('status');
const logElement = document.getElementById('log');

function setStatus(message, connected = false) {
    statusElement.textContent = message;
    statusElement.classList.toggle('connected', connected);
}

function log(message) {
    const line = document.createElement('div');
    line.textContent = message;
    logElement.prepend(line);
}

function init() {
    if (!navigator.bluetooth) {
        setStatus('Bluetooth non disponible');
        alert('Utilise Chrome ou Edge sur un appareil compatible BLE.');
        return;
    }

    log('Application prête');
}

// Sélection du Raspberry Pi
async function pair() {
    try {
        device = await navigator.bluetooth.requestDevice({
            filters: [{ services: [SERVICE_UUID] }]
        });

        device.addEventListener(
            'gattserverdisconnected',
            onDisconnected
        );

        log('Périphérique sélectionné : ' + device.name);
        setStatus('Périphérique sélectionné');

        return device;

    } catch (error) {
        console.error(error);
        log('Appairage annulé ou impossible : ' + error.message);
        throw error;
    }
}

// Connexion Bluetooth
async function connect() {
    try {
        if (!navigator.bluetooth) {
            throw new Error('Web Bluetooth non disponible');
        }

        if (!device) {
            await pair();
        }

        setStatus('Connexion en cours...');

        server = await device.gatt.connect();

        const service = await server.getPrimaryService(SERVICE_UUID);

        // Caractéristique RX : commandes vers le Pico
        tx = await service.getCharacteristic(RX_UUID);

        // Caractéristique TX : réponses du Pico
        try {
            rx = await service.getCharacteristic(TX_UUID);

            if (rx.properties.notify) {
                await rx.startNotifications();

                rx.addEventListener(
                    'characteristicvaluechanged',
                    event => {
                        const response = new TextDecoder().decode(
                            event.target.value
                        );

                        log('Pico : ' + response);
                    }
                );
            }
        } catch (error) {
            console.warn('Notifications indisponibles', error);
        }

        setStatus('Connecté à ' + device.name, true);
        log('Connexion Bluetooth établie');

    } catch (error) {
        console.error(error);
        setStatus('Erreur de connexion');
        log('Erreur : ' + error.message);
    }
}

// Déconnexion
async function disconnect() {
    if (device && device.gatt.connected) {
        device.gatt.disconnect();
    }
}

function onDisconnected() {
    tx = null;
    rx = null;
    server = null;

    setStatus('Déconnecté');
    log('Bluetooth déconnecté');
}

// Envoi d'une commande
async function sendCmd(command) {
    try {
        if (!tx || !device?.gatt.connected) {
            throw new Error('Connecte d’abord le bandeau LED');
        }

        const bytes = new TextEncoder().encode(command);

        if (bytes.length > 20) {
            throw new Error('Commande trop longue (20 octets maximum)');
        }

        if (tx.properties.write) {
            await tx.writeValueWithResponse(bytes);
        } else if (tx.properties.writeWithoutResponse) {
            await tx.writeValueWithoutResponse(bytes);
        } else {
            throw new Error('Écriture Bluetooth non disponible');
        }

        log('Envoyé : ' + command);

    } catch (error) {
        console.error(error);
        log('Erreur : ' + error.message);
    }
}

// Commandes d'animation
function setAnimation(animation) {
    sendCmd('anim ' + animation);
}

// Commandes de vitesse
function setSpeed(value) {
    document.getElementById('speedValue').textContent = value;
    sendCmd('speed ' + value);
}

// Commandes de luminosité
function setBrightness(value) {
    document.getElementById('brightnessValue').textContent = value + '%';
    sendCmd('bri ' + value);
}


if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(() => console.log('PWA installée'))
            .catch(error => console.error(error));
    });
}


init();
