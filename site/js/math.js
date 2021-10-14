const PAD = [
  '0x0001ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  '0xffffffffffffffffffffffff003031300d060960864801650304020105000420'];
const N2H = '0123456789abcdef';


function IntToHexArray(i) {
  var n = BigInt(i);
  var arr = [];
  var exp = BigInt(1);
  for(let j = 0; j < 8; j++) {
    let hx = '';
    for(let k = 0; k < 64; k++) {
      hx += N2H[n % BigInt(16)];
      n = n / BigInt(16);
    }
    hx = '0x' + hx.split('').reverse().join('');
    arr.push(hx);
  }
  return arr.reverse();
}

function HexArrayToInt(hex_array) {
  let hex = '0x' + hex_array.join('').replaceAll('0x', '');
  return BigInt(hex, 16);
}

function Sign(rand, modulus, exponent) {
  let e = BigInt(exponent);
  let one = BigInt(1);
  let two = BigInt(2);
  let multiplier = BigInt(1);
  let result = BigInt(rand);
  while(e > one) {
    if(e % two == one) {
      multiplier = (multiplier * result) % modulus;
    }
    result = (result * result) % modulus;
    e = e / two;
  }
  return (result * multiplier) % modulus;
}

function ParseWeiFromEth(eth_string) {
  const re = /^(0?\b|[1-9]\d*\b)?\.?(\d*)$/;
  let amount_wei = BigInt(0);
  let m = eth_string.match(re);
  if(m) {
    if(m[1]) {
      amount_wei += BigInt(m[1]) * ETH;
    }
    if(m[2]) {
      let exp = BigInt(ETH);  // Reduce this by division by 10
      for(let i = 0; i < m[2].length && exp > BigInt(1); i++) {
        exp /= BigInt(10);
        amount_wei += BigInt(m[2][i]) * exp;
      }
    }
    return amount_wei;
  }
  else {
    window.alert('Invalid amount entered');
  }
}

function EthFromWei(wei_bigint) {
  let wei = BigInt(wei_bigint);
  let decimal = wei % ETH;
  let whole = wei / ETH;
  let eth = whole.toString() + '.';
  let maxwei = BigInt(1e17);
  let num_decimals = 0;
  while(decimal < maxwei && maxwei > 0 && decimal > 0 && num_decimals < 5) {
    eth = eth + '0';
    maxwei = maxwei / BigInt(10);
    num_decimals++;
  }
  if(num_decimals < 5) {
    eth = eth + decimal.toString().slice(0, 5 - num_decimals);
  }
  return eth;
}

function EthAndWeiFromWei(wei_bigint) {
  return EthFromWei(wei_bigint) + 'ETH (' + wei_bigint.toString() + ' WEI)';
}
