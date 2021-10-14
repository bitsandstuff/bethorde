var ETH_ENABLED = false;
var web3;
var CURRENT_WALLET_ADDRESS = null;
var CURRENT_HOUSE_ADDRESS = null;
var CURRENT_PLAYER_ADDRESS = null;
var BETHORDE = null;
var BLOCK_NUMBER = null;
var PLAYER_EXISTS = false;
var HOUSE_EXISTS = false;
var HOUSE_PAUSE_STATE = null;
var CURRENT_BET = null;
var CURRENT_HOUSE = null;
var STATE = null;
var CHANGE_LISTEN = false;

const GWEI = BigInt(10) ** BigInt(9);
const ETH = BigInt(10) ** BigInt(18);
const MAX_256 = BigInt(2) ** BigInt(256) - BigInt(1);
const ADDRESS_RXP = /^(0x)?[0-9a-fA-F]{40}$/;
const CONFIRM_BLOCKS = 12;

const CONTRACT_ADDRESS = '0x90264Fe0d57258bF1773a2A8E4853bE3bc800a18';
const DEV_ADDRESS = '0x225507634D2a85Dd060a50f5868C4D19dFb2e775';
const DISCLAIMER = 'By continuing to use this site, you affirm that you are '
                 + 'over 21 years of age and are not in a jurisdiction '
                 + 'where online betting violates local laws.';


async function CheckBrowser() {
  if(!ETH_ENABLED) {
    $('#house_address').val('0');
    if(!window.confirm(DISCLAIMER)) {
      window.location.href = "https://google.com";
      throw('Disclaimer not approved.');
    }
  }
  $('#connect_button').prop('disabled', true);
  $('#connect_spinner').show();
  if(window.ethereum) {
    ETH_ENABLED = true;
    web3 = new Web3(window.ethereum);
    try {
      await window.ethereum.enable();
      BETHORDE = new web3.eth.Contract(JSON.parse(ABI), CONTRACT_ADDRESS);
      await UpdateCurrentWalletAddress();
      await UpdateState();
      await CheckExistence();
      UpdateBlockNumber();
      $('#connect_button').hide();
      $('.eth_div').show();
      SelectHouse();
      UpdateControls();
      if(!CHANGE_LISTEN) {
        CHANGE_LISTEN = true;
        ethereum.on('accountsChanged', function (acc) {
          RefreshAll();
        });
        setInterval(UpdateControls, 200);
        setInterval(UpdateBlockNumber, 60000);
        setInterval(UpdateState, 30000);
      }
    } catch (error) {
      console.log(error);
    }
  } else {
    window.alert('Site requires MetaMask');
  }
  $('#connect_button').prop('disabled', false);
  $('#connect_spinner').hide();
}

async function CheckExistence() {
  let h = await BETHORDE.methods.ViewHouse(CURRENT_WALLET_ADDRESS).call();
  if(h.pause_block > 0) {
    HOUSE_EXISTS = true;
  } else {
    HOUSE_EXISTS = false;
  }
  let p = await BETHORDE.methods.players(CURRENT_WALLET_ADDRESS).call();
  if(p.creation_block === '0') {
    PLAYER_EXISTS = false;
  } else {
    PLAYER_EXISTS = true;
  }
}

async function GetContractState() {
  let state = await BETHORDE.methods.state().call();
  let state_dict = {'owner': state.owner,
                    'bet_counter': state.bet_counter,
                    'reserved_eth': state.reserved_eth,
                    'sale_price': state.sale_price,
                    'last_bet_timestamp': state.last_bet_time,
                    'num_houses': state.num_houses,
                    'total_eth': await web3.eth.getBalance(CONTRACT_ADDRESS)};
  return state_dict;
}

async function UpdateState() {
  STATE = await GetContractState();
  let d = new Date(Number(STATE.last_bet_timestamp) * 1000);
  $('#last_bet_timestamp').html(d.toString());
  if(BigInt(STATE.sale_price) == MAX_256) {
    $('#sale_price').html('&infin;');
  } else {
    $('#sale_price').html(EthFromWei(STATE.sale_price) + ' ETH');
  }
  $('#reserved_eth').html(EthFromWei(STATE.reserved_eth) + ' ETH');
  $('#contract_balance').html(EthFromWei(STATE.total_eth) + ' ETH');
  $('#num_houses').html(STATE.num_houses);
  $('#contract_bets').html(STATE.bet_counter);
}

function EditHouse() {
  $('#edit_house').hide();
  $('#set_house').show();
  $('#auto_house').show();
  $('#house_address').prop('disabled', false);
  ClearHouse();
}

function NextHouse() {
  $('#house_address').val(
      (BigInt(CURRENT_HOUSE.house_address_index) + BigInt(1)).toString());
  SelectHouse();
}

function PreviousHouse() {
  $('#house_address').val(
      (BigInt(CURRENT_HOUSE.house_address_index) - BigInt(1)).toString());
  SelectHouse();
}

async function SelectHouse() {
  let address_or_index = $('#house_address').val();
  CURRENT_HOUSE = null;
  $('#prev_house').hide();
  $('#next_house').hide();
  try {
    $('#house_address').prop('disabled', true);
    if(address_or_index.match(/^\d+$/)) {
      address_or_index = await BETHORDE.methods.house_addresses(address_or_index).call();
      console.log('Found house address: ' + address_or_index);
    }
    if(address_or_index.match(ADDRESS_RXP)) {
      CURRENT_HOUSE = await BETHORDE.methods.ViewHouse(address_or_index).call();
      CURRENT_HOUSE_ADDRESS = address_or_index;
      $('#house_address').val(address_or_index);
      let house_balance = EthFromWei(BigInt(CURRENT_HOUSE.balance)).toString()
                          + ' (' + CURRENT_HOUSE.balance + ' WEI)';
      $('#house_balance').html(EthAndWeiFromWei(CURRENT_HOUSE.balance));
      $('#house_bet_balance').html(EthAndWeiFromWei(CURRENT_HOUSE.bet_balance));
      $('#house_active_bets').html(CURRENT_HOUSE.active_bets);
      $('#house_completed').html(CURRENT_HOUSE.completed_bets);
      $('#house_max_loss').html(EthAndWeiFromWei(CURRENT_HOUSE.max_loss));
      $('#house_min_bet').html(EthAndWeiFromWei(CURRENT_HOUSE.min_bet));
      if(CURRENT_HOUSE.first_bet == '0') {
        $('#house_first_bet').html('--');
      } else {
        $('#house_first_bet').html(CURRENT_HOUSE.first_bet);
      }
      if(BigInt(CURRENT_HOUSE.pause_block) <= BLOCK_NUMBER) {
        $('#pause_house').show();
        $('#pause_text').html('Unpause house');
        $('#house_pause').html('Currently paused');
        HOUSE_PAUSE_STATE = 'PAUSED';
      } else if(BigInt(CURRENT_HOUSE.pause_block) == MAX_256) {
        $('#pause_house').show();
        $('#pause_text').html('Pause house');
        $('#house_pause').html('No pause scheduled');
        HOUSE_PAUSE_STATE = 'NONE';
      } else {
        $('#pause_house').hide();
        let diff = BigInt(CURRENT_HOUSE.pause_block) - BigInt(BLOCK_NUMBER);
        $('#house_pause').html('Pause begins in block '
                               + BigInt(CURRENT_HOUSE.pause_block).toString()
                               + ' (in ' + diff.toString() + ' blocks)');
        HOUSE_PAUSE_STATE = 'PENDING';
      }
      let last_low = new Date(Number(CURRENT_HOUSE.last_low_balance_timestamp) * 1000);
      $('#house_low_balance').html(last_low.toString());
      $('#edit_house').show();
      $('#set_house').hide();
      $('#auto_house').hide();

      if(Number(CURRENT_HOUSE.house_address_index) > 0) {
        $('#prev_house').show();
      }
      if(Number(CURRENT_HOUSE.house_address_index) < Number(STATE.num_houses) - 1) {
        $('#next_house').show();
      }
    } else {
      throw 'No house found.';
    }
  } catch(error) {
    ClearHouse();
    window.alert('Invalid house identifier');
    console.log(error);
    EditHouse();
  }
}

function ClearHouse() {
  CURRENT_HOUSE_ADDRESS = null;
  $('#house_balance').html('--');
  $('#house_bet_balance').html('--');
  $('#house_active_bets').html('--');
  $('#house_completed').html('--');
  $('#house_pause').html('--');
  $('#house_max_loss').html('--');
  $('#house_min_bet').html('--');
  $('#house_low_balance').html('--');
  $('#house_first_bet').html('--');
}

function EditPlayer() {
  CURRENT_PLAYER_ADDRESS = null;
  $('#edit_player').hide();
  $('#set_player').show();
  $('#player_address').prop('disabled', false);
  $('#auto_player').show();
}

async function SelectPlayer() {
  $('#edit_player').show();
  $('#set_player').hide();
  $('#auto_player').hide();
  $('#player_address').prop('disabled', true);
  let address = $('#player_address').val();
  $('#player_address').removeClass('error_form');
  try {
    let player = await BETHORDE.methods.players(address).call();
    if(player.creation_block === '0') {
      ClearPlayer();
    } else {
      CURRENT_PLAYER_ADDRESS = address;
      $('#player_balance').html(EthFromWei(player.balance) + ' ETH');
      $('#player_active_bets').html(player.active_bets);
      $('#player_winnings').html(EthFromWei(player.winnings) + ' ETH');
      $('#player_last_nonce').html(player.nonce);
    }
  } catch(error) {
    console.log(error);
    EditPlayer();
    $('#player_address').addClass('error_form');
  }
}

function ClearPlayer() {
  CURRENT_PLAYER_ADDRESS = null;
  $('#player_balance').html('--');
  $('#player_active_bets').html('--');
  $('#player_winnings').html('--');
  $('#player_last_nonce').html('--');
}

function EditBet() {
  CURRENT_BET = null;
  $('#edit_bet').hide();
  $('#set_bet').show();
  $('#bet_id').prop('disabled', false);
  $('#decide_bet').prop('disabled', true);
  $('#force_bet').prop('disabled', true);
  $('#bet_info').hide();
}

async function SelectBet() {
  $('#edit_bet').show();
  $('#set_bet').hide();
  $('#bet_id').prop('disabled', true);
  let bet_number = $('#bet_id').val();
  if(bet_number.match(/^\d+$/)) {
    try {
      CURRENT_BET = await BETHORDE.methods.bets(bet_number).call();
      if(CURRENT_BET.odds == '0') {
        window.alert('Bet does not exist.');
        EditBet();
      }
    } catch(error) {
      console.log(error);
      EditBet();
    }
  } else {
    EditBet();
    window.alert('Bet ID must be a number');
  }
  if(CURRENT_BET) {
    let diff = new Date() - new Date(Number(CURRENT_BET.timestamp) * 1000);
    if(diff <= 3600000) {
      let mins = Math.floor(diff / 60000);
      $('#bet_age').html('Placed ' + mins.toString() + ' minutes ago.');
    } else {
      let hours = Math.floor(diff / 3600000);
      $('#bet_age').html('Placed ' + hours.toString() + ' hours ago.');
    }

    $('#bet_odds').html(CURRENT_BET.odds.toString() + ' : 1');
    let bet_price = BigInt(CURRENT_BET.price_gwei) * GWEI;
    $('#bet_price').html(EthAndWeiFromWei(bet_price));
    let bet_pot = bet_price * BigInt(CURRENT_BET.odds.toString());
    $('#bet_pot').html(EthFromWei(bet_pot) + ' ETH');

    $('#bet_player').html(CURRENT_BET.player);
    $('#bet_house').html(CURRENT_BET.house);
    $('#bet_randomness').html(CURRENT_BET.randomness);

    $('#prev_bet').hide();
    $('#next_bet').hide();
    if(Number(CURRENT_BET.previous_house_bet) > 0) {
      $('#prev_bet').show();
    }
    if(Number(CURRENT_BET.next_house_bet) > 0) {
      $('#next_bet').show();
    }
    $('#bet_info').show();
  }
}

function PreviousBet() {
  if(Number(CURRENT_BET.previous_house_bet) > 0) {
    $('#bet_id').val(CURRENT_BET.previous_house_bet);
    DisableModalExit();
    SelectBet().then(EnableModalExit);
  } else {
    window.alert('Invalid request.');
  }
}

function NextBet() {
  if(Number(CURRENT_BET.next_house_bet) > 0) {
    $('#bet_id').val(CURRENT_BET.next_house_bet);
    DisableModalExit();
    SelectBet().then(EnableModalExit);
  } else {
    window.alert('Invalid request.');
  }
}

function PopulateBet() {
  NewRandom();
  $('#bet_nonce').val(Number($('#player_last_nonce').html()) + 1);
}

function SignBet() {
  let d = BigInt(prompt('Provide your private key as an integer.'));
  let mod = HexArrayToInt(CURRENT_HOUSE.modulus);
  let rand = [...PAD];
  rand.push($('#bet_randomness').html());
  rand = HexArrayToInt(rand);
  let signed = Sign(rand, mod, d);
  $('#signed_randomness').val(signed.toString());
}

async function UpdateCurrentWalletAddress() {
  let accounts = await web3.eth.getAccounts();
  CURRENT_WALLET_ADDRESS = accounts[0];
  return 0;
}

function SetAddressFromMetamask(address_id) {
  UpdateCurrentWalletAddress().then(
    function(value) {
      $(address_id).val(CURRENT_WALLET_ADDRESS);
    });      
}

function SetOldestBet() {
  if(CURRENT_HOUSE && CURRENT_HOUSE.first_bet != '0') {
    $('#bet_id').val(CURRENT_HOUSE.first_bet);
    SelectBet();
  } else if(CURRENT_HOUSE) {
    window.alert('House has no pending bets.');
  } else {
    window.alert('Select house to use this.');
  }
}

function PlayerIsCurrentWallet() {
  return CURRENT_PLAYER_ADDRESS == CURRENT_WALLET_ADDRESS;
}

function HouseIsCurrentWallet() {
  return CURRENT_HOUSE_ADDRESS == CURRENT_WALLET_ADDRESS;
}

function NewRandom() {
  const hex = '0123456789abcdef';
  let arr = [];
  for(let i=0; i < 64; i++) {
    arr.push(hex[Math.floor(Math.random() * 16)]);
  }
  let rand = arr.join('');
  $('#randomness').val(rand);
}

function CreatePlayer() {
  $('#create_player_spinner').show();
  $('#create_player').prop('disabled', true);
  try {
    BETHORDE.methods.CreatePlayer().send({from: CURRENT_WALLET_ADDRESS})
        .on('receipt', function(receipt) {
          console.log('Player creation request confirmed.');
        })
        .on('error', function(error) {
          console.log(error);
          HandleCreatePlayerError();
        })
        .on('confirmation', function(confirmation_number, receipt) {
          if(confirmation_number == CONFIRM_BLOCKS) {
            CheckExistence();
            let msg = 'Player "' + CURRENT_WALLET_ADDRESS + '" created.';
            console.log(msg);
            window.alert(msg);
            $('#create_player').remove();
          }
        });
  } catch(error) {
    console.log(error);
    HandleCreatePlayerError();
  }
}

function HandleCreatePlayerError() {
  $('#create_player_spinner').hide();
  $('#create_player').prop('disabled', false);
}

function PlaceBet() {
  DisableModalExit();
  $('#place_bet_spinner').show();
  $("#place_bet_button").prop('disabled', true);

  let odds = BigInt($('#odds').val());
  let amount_gwei = ParseWeiFromEth($('#bet_amount').val()) / GWEI;
  let nonce = BigInt($('#bet_nonce').val());
  let randomness = '0x' + $('#randomness').val();
  let timestamp = Math.floor(new Date().getTime() / 1000);
  let top_up = ParseWeiFromEth($('#bet_top_up').val());
  try {
    if(odds < 2 || odds > 1000000) {
      throw 'Odds must be between 2 and 1 million (inclusive).';
    }
    if(CURRENT_PLAYER_ADDRESS != CURRENT_WALLET_ADDRESS) {
      throw 'Cannot place bets on behalf of other players.';
    }
    let param = null;
    if(top_up > 0) {
      param = {from: CURRENT_WALLET_ADDRESS, value: top_up.toString()};
    } else {
      param = {from: CURRENT_WALLET_ADDRESS};
    }
    BETHORDE.methods.PlaceBet(CURRENT_HOUSE_ADDRESS, odds, amount_gwei,
                              randomness, nonce, timestamp).send(param)
        .on('receipt', function(receipt) {
          console.log('Bet received');
          EnableModalExit();
          $('#place_bet_spinner').hide();
          $('#betModal').modal('hide');
          $("#place_bet_button").prop('disabled', false);
        })
        .on('error', HandlePlaceBetError)
        .on('confirmation', function(confirmation_number, receipt) {
          console.log('Place bet confirmation: ' + confirmation_number);
          if(confirmation_number == CONFIRM_BLOCKS) {
            window.alert('Bet confirmed.');
          }
        });
  } catch(error) {
    HandlePlaceBetError(error);
  }
}

function HandlePlaceBetError(error) {
  console.log(error);
  window.alert('Error placing bet.');
  $('#place_bet_spinner').hide();
  $("#place_bet_button").prop('disabled', false);
  EnableModalExit();
}

function OpenOrAdjustHouse() {
  DisableModalExit();
  let modulus = $('#modulus_input').val();
  if(modulus.match(/^\d+$/)) {
    modulus = IntToHexArray(BigInt(modulus));
  } else {
    modulus = modulus.replaceAll('"', '')
                     .replaceAll("'", '')
                     .replaceAll(' ', '')
                     .replaceAll('[', '')
                     .replaceAll(']', '')
                     .split(',');
  }
  let max_loss = ParseWeiFromEth($('#max_loss_input').val());
  let min_bet = ParseWeiFromEth($('#min_bet_input').val());
  let take = BigInt($('#take_input').val());
  let funding = ParseWeiFromEth($('#house_adjust_fund_input').val());
  $('#house_spinner').show();
  $('#house_button').prop('disabled', true);
  let change = 'created.';
  if(HouseIsCurrentWallet()) {
    change = 'adjusted.';
  }
  try {
    if(take < 0 && take > 1000) {
      throw 'Take must be between 0 and 10%.';
    }
    if(!(CURRENT_HOUSE_ADDRESS) && funding < BigInt(1e17)) {
      throw 'New houses need at least 0.1 ETH.';
    }
    BETHORDE.methods.OpenOrAdjustHouse(modulus, max_loss, min_bet, take)
        .send({from: CURRENT_WALLET_ADDRESS, value: funding.toString()})
        .on('receipt', function(receipt) {
          console.log(receipt);
          EnableModalExit();
          $('#house_spinner').hide();
          $('#house_button').prop('disabled', false);
          $('#houseModal').modal('hide');
        })
        .on('error', HandleAdjustError)
        .on('confirmation', function(confirmation_number, receipt) {
          if(confirmation_number == CONFIRM_BLOCKS) {
            CheckExistence();
            let msg = 'House "' + CURRENT_WALLET_ADDRESS + '" ' + change;
            console.log(msg);
            window.alert(msg);
          }
        });
  } catch(error) {
    HandleAdjustError(error);
  }
}

function HandleAdjustError(error) {
  console.log(error);
  $('#house_spinner').hide();
  $('#house_button').prop('disabled', false);
  $('#houseModal').modal('hide');
  EnableModalExit();
}

function ShowModulus() {
  if(CURRENT_HOUSE) {
    let as_array = '[' + CURRENT_HOUSE.modulus.toString() + ']';
    let as_int = HexArrayToInt(CURRENT_HOUSE.modulus);
    $('#modulus_array').html(as_array);
    $('#modulus_integer').html(as_int);
  } else {
    window.alert('No house selected');
  }
}

function FundHouse() {
  DisableModalExit();
  $('#fund_house_spinner').show();
  $('#fund_house_button').prop('disabled', true);
  $('#fund_house').prop('disabled', true);
  let amount_wei = ParseWeiFromEth($('#fund_amount').val());

  if(!HouseIsCurrentWallet()) {
    window.alert('Selected house must match wallet.');
    return null;
  }

  try {
    BETHORDE.methods.FundHouse().send(
        {value: amount_wei.toString(), from: CURRENT_WALLET_ADDRESS})
        .on('receipt', function(receipt) {
          console.log(receipt);
          EnableModalExit();
          $('#fund_house_spinner').hide();
          $('#fund_house_button').prop('disabled', false);
          $('#house_spinner').hide();
          $('#fundModal').modal('hide');
        })
        .on('error', HandleFundHouseError)
        .on('confirmation', function(confirmation_number, receipt) {
          if(confirmation_number == CONFIRM_BLOCKS) {
            let msg = 'Funds added to house "' + CURRENT_WALLET_ADDRESS + '".';
            console.log(msg);
            window.alert(msg);
            $('#house_button').prop('disabled', false);
            $('#fund_house').prop('disabled', false);
          }
        });
  } catch(error) {
    HandleFundHouseError(error);
  }
}

function HandleFundHouseError(error) {
  console.log(error);
  window.alert('Failed to add funds.');
  $('#fund_house_spinner').hide();
  $('#fund_house_button').prop('disabled', false);
  $('#fund_house').prop('disabled', false);
  EnableModalExit();
}

function DecideBet() {
  DisableModalExit();
  $('#decide_bet').prop('disabled', true);
  $('#decide_spinner').show();

  let bet_number = BigInt($('#bet_id').val());
  let signed = $('#signed_randomness').val();
  signed = signed.replaceAll('"', '')
                 .replaceAll("'", '')
                 .replaceAll(' ', '')
                 .replaceAll('[', '')
                 .replaceAll(']', '');
  if(signed.match(/^\d+$/)) {
    signed = IntToHexArray(BigInt(signed));
  } else if(signed.match(/^(0x[0-9a-f]{64},){7}0x[0-9a-f]{64}$/)) {
    signed = signed.split(',');
  }
  try {
    console.log(bet_number);
    console.log(signed);
    BETHORDE.methods.DecideBet(bet_number, signed).send({from: CURRENT_WALLET_ADDRESS})
        .on('receipt', function(receipt) {
          console.log(receipt);
          EnableModalExit();
          $('#decide_spinner').hide();
          $('#viewBetModal').modal('hide');
          $('#decide_bet').prop('disabled', false);
        })
        .on('error', HandleDecideError)
        .on('confirmation', function(confirmation_number, receipt) {
          if(confirmation_number == CONFIRM_BLOCKS) {
            let msg = 'Bet ' + bet_number + ' decided.';
            window.alert(msg);
          }
        });
  } catch(error) {
    HandleDecideError(error);
  } 
}

function HandleDecideError(error) {
  console.log(error);
  window.alert('Error deciding bet.');
  $('#decide_spinner').hide();
  $('#decide_bet').prop('disabled', false);
  EnableModalExit();
}

function ForceBet() {
  DisableModalExit();
  $('#force_bet').prop('disabled', true);
  $('#force_spinner').show();

  let bet_number = BigInt($('#bet_id').val());

  try {
    BETHORDE.methods.ForceBet(bet_number).send({from: CURRENT_WALLET_ADDRESS})
        .on('receipt', function(receipt) {
          console.log(receipt);
          EnableModalExit();
          $('#force_spinner').hide();
          $('#viewBetModal').modal('hide');
          $('#force_bet').prop('disabled', false);
        })
        .on('error', HandleForceError)
        .on('confirmation', function(confirmation_number, receipt) {
          if(confirmation_number == CONFIRM_BLOCKS) {
            let msg = 'Bet ' + bet_number + ' force resolved.';
            window.alert(msg);
          }
        });
  } catch(error) {
    HandleForceError(error);
  } 
}

function HandleForceError(error) {
  console.log(error);
  window.alert('Error forcing bet.');
  $('#force_spinner').hide();
  $('#force_bet').prop('disabled', false);
  EnableModalExit();
}

function HouseWithdraw() {
  DisableModalExit();
  $('#house_withdraw').prop('disabled', true);
  $('#player_withdraw').prop('disabled', true);
  $('#house_withdraw_spinner').show();

  let amount_wei = ParseWeiFromEth($('#withdraw_amount').val());
  let amount_msg = EthAndWeiFromWei(amount_wei);

  try {
    if(!(window.confirm('Withdraw ' + amount_msg + ' from house?'))) {
      throw 'User cancelled withdrawal.';
    }
    BETHORDE.methods.HouseWithdraw(amount_wei).send({from: CURRENT_WALLET_ADDRESS})
        .on('receipt', function(receipt) {
          console.log(receipt);
          EnableModalExit();
          $('#player_withdraw').prop('disabled', false);
          $('#house_withdraw_spinner').hide();
          $('#withdrawModal').modal('hide');
        })
        .on('error', HandleWithdrawError)
        .on('confirmation', function(confirmation_number, receipt) {
          if(confirmation_number == CONFIRM_BLOCKS) {
            let msg = 'House withdrawal complete: ' + amount_msg;
            window.alert(msg);
            $('#house_withdraw').prop('disabled', false);
          }
        })
  } catch(error) {
    HandleWithdrawError(error);
  }
}

function PlayerWithdraw() {
  DisableModalExit();
  $('#house_withdraw').prop('disabled', true);
  $('#player_withdraw').prop('disabled', true);
  $('#player_withdraw_spinner').show();

  let amount_wei = ParseWeiFromEth($('#withdraw_amount').val());
  let amount_msg = EthAndWeiFromWei(amount_wei);

  try {
    BETHORDE.methods.PlayerWithdraw(amount_wei).send({from: CURRENT_WALLET_ADDRESS})
        .on('receipt', function(receipt) {
          console.log(receipt);
          EnableModalExit();
          $('#player_withdraw').prop('disabled', false);
          $('#player_withdraw_spinner').hide();
          $('#withdrawModal').modal('hide');
        })
        .on('error', HandleWithdrawError)
        .on('confirmation', function(confirmation_number, receipt) {
          if(confirmation_number == CONFIRM_BLOCKS) {
            let msg = 'Player withdrawal complete: ' + amount_msg;
            window.alert(msg);
            $('#player_withdraw').prop('disabled', false);
          }
        })
  } catch(error) {
    HandleWithdrawError(error);
  }
}

function HandleWithdrawError(error) {
  console.log(error);
  window.alert('Error withdrawing funds');
  $('#house_withdraw').prop('disabled', false);
  $('#player_withdraw').prop('disabled', false);
  $('#house_withdraw_spinner').hide();
  $('#player_withdraw_spinner').hide();
  $('#withdrawModal').modal('hide');
  EnableModalExit();
}

function TogglePauseHouse() {
  DisableModalExit();
  $('#pause_spinner').show();
  $('#pause_house').prop('disabled', true);
  let action = $('#pause_text').html();
  try {
    BETHORDE.methods.TogglePauseHouse().send({from: CURRENT_WALLET_ADDRESS})
        .on('receipt', function(receipt) {
          console.log(receipt);
          EnableModalExit();
        })
        .on('error', HandleToggleError)
        .on('confirmation', function(confirmation_number, receipt) {
          if(confirmation_number == CONFIRM_BLOCKS) {
            let msg = 'House "' + CURRENT_WALLET_ADDRESS + '": ' + action + ' completed.';
            window.alert(msg);
            $('#pause_spinner').hide();
            $('#pause_house').prop('disabled', false);
            SelectHouse();
          }
        });
  } catch(error) {
    HandleToggleError(error);
  }
}

function HandleToggleError(error) {
  console.log(error);
  window.alert('Failed to change pause state.');
  $('#pause_spinner').hide();
  $('#pause_house').prop('disabled', false);
  EnableModalExit();
}

function Donate() {
  DisableModalExit();
  $('#donate_spinner').show();
  $("#donate_button").prop('disabled', true);
  try {
    let donation_eth = $('#donate_amount').val();
    let donation_wei = ParseWeiFromEth(donation_eth).toString();
    web3.eth.sendTransaction(
        {to: DEV_ADDRESS, value: donation_wei, from: CURRENT_WALLET_ADDRESS})
        .on('receipt', function(receipt) {
          console.log('Donation confirmed');
          EnableModalExit();
          $('#donate_spinner').hide();
          $('#donateModal').modal('hide');
          $("#donate_button").prop('disabled', false);
        })
        .on('error', function(error) { console.log(error)})
        .on('confirmation', function(confirmation_number, receipt) {
          console.log('Donate confirmation: ' + confirmation_number);
          if(confirmation_number == CONFIRM_BLOCKS) {
            window.alert('Donation (' + Number(donation_eth) + ' ETH) confirmed.');
          }
        })
        .then(function(receipt) {
          console.log(receipt);
          window.alert('Donation completed');
        });
  } catch(error) {
    console.log(error);
    $('#donate_spinner').hide();
    $("#donate_button").prop('disabled', false);
  }
}

function HideInfos() {
  $('#overview_info').hide();
  $('#overview_nav').removeClass('navselect');
  $('#players_info').hide();
  $('#players_nav').removeClass('navselect');
  $('#houses_info').hide();
  $('#houses_nav').removeClass('navselect');
  $('#details_info').hide();
  $('#details_nav').removeClass('navselect');
  $('#documentation').removeClass('clickable');
  $('#documentation_cell').removeClass('round-div');
}

function ToggleInfos(field) {
  if($(field + '_nav').hasClass('navselect')) {
    HideInfos();
  } else {
    HideInfos();
    $(field + '_info').show();
    $(field + '_nav').addClass('navselect');
    $('#documentation').addClass('clickable');
    $('#documentation_cell').addClass('round-div');
  }
}

function ControlPlayer() {
  $('#nav_control_house').removeClass('navselect');
  $('#nav_control_player').addClass('navselect');
  $('#control_house').hide();
  $('#control_player').show();
}

function ControlHouse() {
  $('#nav_control_house').addClass('navselect');
  $('#nav_control_player').removeClass('navselect');
  $('#control_house').show();
  $('#control_player').hide();
}

function UpdateBlockNumber() {
  web3.eth.getBlockNumber().then(block => {
    BLOCK_NUMBER = BigInt(block);
    setTimeout(UpdateBlockNumber, 60000);
  });
}

function TakeUpdate() {
  let take = $('#take_input').val();
  let take_num = Number(take);
  let info = '...&nbsp;&#37;';
  if((take_num || take_num == 0)
     && !(take.includes('.')) && take_num >= 0 && take_num <= 1000) {
    let pct = Number(take_num) / 100;
    info = pct.toString().match(/^(\d+(?:\.\d\d?)?).*$/)[1] + '&nbsp;&#37;';
  }
  $('#take_span').html(info)
}

function RefreshAll() {
  CheckBrowser().then(function() {
    SelectHouse();
    SelectPlayer();
    UpdateState();
  });
}

$(document).ready(function() {
  HideInfos();
  $('.eth_div').hide();

  $('#connect_spinner').hide();
  $('#donate_spinner').hide();
  $('#place_bet_spinner').hide();
  $('#create_player_spinner').hide();
  $('#house_spinner').hide();
  $('#fund_house_spinner').hide();
  $('#pause_spinner').hide();
  $('#house_withdraw_spinner').hide();
  $('#player_withdraw_spinner').hide();
  $('#force_spinner').hide();
  $('#decide_spinner').hide();

  $('#edit_player').hide();
  $('#edit_house').hide();
  $('#edit_bet').hide();
  $('#bet_info').hide();

  $('#prev_house').hide();
  $('#next_house').hide();
  $('#prev_bet').hide();
  $('#next_bet').hide();

  $('#take_input').on('keyup change', TakeUpdate);
  TakeUpdate();
});
