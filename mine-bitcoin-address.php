<?php

require '/var/www/pseudochan/web-app/vendor/autoload.php';

use Elliptic\EC;

$ec = new EC('secp256k1');

echo "Mining bitcoin address starting with 21e8...\n";
echo "This may take a while...\n\n";

$attempts = 0;
$startTime = time();

while (true) {
    $attempts++;

    // Generate keypair
    $keyPair = $ec->genKeyPair();
    $privKey = $keyPair->getPrivate('hex');
    $pubKey = $keyPair->getPublic('hex');

    // Convert pubkey to bitcoin address
    $pubkeyBin = hex2bin($pubKey);
    $sha256 = hash('sha256', $pubkeyBin, true);
    $ripemd160 = hash('ripemd160', $sha256, true);

    $versioned = "\x00" . $ripemd160;
    $checksum = substr(hash('sha256', hash('sha256', $versioned, true), true), 0, 4);

    $address = $versioned . $checksum;

    // Base58 encode
    $alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    $num = gmp_init(bin2hex($address), 16);
    $encoded = '';

    while (gmp_cmp($num, 0) > 0) {
        list($num, $remainder) = gmp_div_qr($num, 58);
        $encoded = $alphabet[gmp_intval($remainder)] . $encoded;
    }

    for ($i = 0; $i < strlen($address) && $address[$i] === "\x00"; $i++) {
        $encoded = '1' . $encoded;
    }

    $bitcoinAddress = $encoded;

    // Check if it starts with 21e8
    if (substr($bitcoinAddress, 0, 4) === '21e8') {
        $elapsed = time() - $startTime;
        echo "SUCCESS!\n";
        echo "Attempts: $attempts\n";
        echo "Time: {$elapsed}s\n\n";
        echo "Private Key: $privKey\n";
        echo "Public Key: $pubKey\n";
        echo "Bitcoin Address: $bitcoinAddress\n";
        break;
    }

    if ($attempts % 1000 === 0) {
        echo "Attempts: $attempts (current: $bitcoinAddress)\n";
    }
}
