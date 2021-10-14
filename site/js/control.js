function UpdateControls() {
  HouseControls();
  PlayerControls();
  WithdrawControls();
  BetControls();
}

function HouseControls() {
  $('.house_control').hide();
  $('#adjust_house').show();
  if(!(HOUSE_EXISTS)) {
    $('#adjust_house').html('Open House');
  } else if(CURRENT_HOUSE_ADDRESS == CURRENT_WALLET_ADDRESS) {
    $('.house_control').show();
    $('#adjust_house').html('Adjust House');
    $('#house_button_text').html('Adjust House');
    if(HOUSE_PAUSE_STATE == 'PAUSED') {
      $('#adjust_house').prop('disabled', false);
      $('#pause_house').prop('disabled', false);
      $('#pause_text').html('Unpause House');
    } else if(HOUSE_PAUSE_STATE == 'PENDING') {
      $('#adjust_house').prop('disabled', true);
      $('#pause_house').prop('disabled', true);
      $('#pause_text').html('Pause Pending');
    } else {
      $('#adjust_house').prop('disabled', true);
      $('#pause_house').prop('disabled', false);
      $('#pause_text').html('Pause House');
    }
  } else {
    $('.house_control').hide();
    $('#adjust_house').hide();
  }
}

function PlayerControls() {
  $('#create_player').hide();
  $('#place_bet').hide();
  if(!(PLAYER_EXISTS)) {
    $('#create_player').show();
  } else if(CURRENT_PLAYER_ADDRESS == CURRENT_WALLET_ADDRESS) {
    $('#place_bet').show();
  }
}

function WithdrawControls() {
  $('#withdraw_button').hide();
  $('#player_withdraw').hide();
  $('#house_withdraw').hide();
  $('#house_withdraw').prop('disabled', true);
  if(PLAYER_EXISTS && CURRENT_PLAYER_ADDRESS == CURRENT_WALLET_ADDRESS) {
    $('#player_withdraw').show();
    $('#withdraw_button').show();
  }
  if(HOUSE_EXISTS && CURRENT_HOUSE_ADDRESS == CURRENT_WALLET_ADDRESS) {
    $('#withdraw_button').show();
    $('#house_withdraw').show();
    if(HOUSE_PAUSE_STATE == 'PAUSED') {
      $('#house_withdraw').prop('disabled', false);
    }
  }
}

function BetControls() {
  $('#force_bet').prop('disabled', true);
  $('#decide_bet').prop('disabled', true);
  $('#decide_bet').hide();
  $('#signed_div').hide();
  if(CURRENT_BET) {
    if(CURRENT_HOUSE_ADDRESS == CURRENT_BET.house
       && HouseIsCurrentWallet()) {
      $('#decide_bet').show();
      $('#decide_bet').prop('disabled', false);
      $('#signed_div').show();
    }
    if(CURRENT_BET.timestamp
       < Math.floor((new Date() - (24 * 3600 * 1000)) / 1000)) {
      $('#force_bet').prop('disabled', false);
    }
  }
}

function DisableModalExit() {
  $('.modal_close').prop('disabled', true);
}

function EnableModalExit() {
  $('.modal_close').prop('disabled', false);
}
