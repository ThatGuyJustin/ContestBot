global.Discord = require("discord.js");
global.sqlite3 = require('sqlite3').verbose();
global.config = require("./config.json");
global.DBManager = require("./modules/dbmanager.js"); 
global.Database = DBManager.startDB();
global.Client = new Discord.Client( { disableEveryone: true } );
global.handler = require("./modules/handler.js");

Database.getAsync = function (sql) {
  var that = this;
  return new Promise(function (resolve, reject) {
    that.get(sql, function (err, row) {
      if (err)
        reject(err);
      else
        resolve(row);
    });
  });
};

Database.getAllAsync = function (sql) {
  var that = this;
  return new Promise(function (resolve, reject) {
    that.all(sql, function (err, rows) {
      if (err)
        reject(err);
      else
        resolve(rows);
    });
  });
};

Client.on('message', async (message) => {
  if(message.content.startsWith(`${config.discord.prefix}forceleaderboard`) || message.content.startsWith(`${config.discord.prefix}flb`)){
    if(message.guild && handler.checkUser(message.author.id, message)){
      let data = await DBManager.GetLeaderboard();
      handler.forceUpdate(data);
      message.react('✅');
    }else{
      message.react('⛔');
    }
  }
  if(message.content.startsWith(`${config.discord.prefix}leaderboard`) || message.content.startsWith(`${config.discord.prefix}lb`)){
    if(message.channel.type == "dm" || config.discord.bot_cmd_channels.indexOf(message.channel.id) > -1){
      let data = await DBManager.GetLeaderboard();
      handler.cmdLeaderboard(data, message);
    }
  }
  if(message.channel.type == "dm")
      handler.handleDM(message);
  return;
});

Client.on('raw', (event) => {
  if(event.t == 'MESSAGE_REACTION_ADD' || event.t == 'MESSAGE_REACTION_REMOVE'){
    if(event.d.emoji.name != '✅' || event.d.channel_id != config.discord.submissions_channel || event.d.user_id == Client.user.id) return;
    handler.updateSubmissionVotes(event.d.message_id, event.t == 'MESSAGE_REACTION_ADD' ? true: false, event.d.user_id);
  }
})

Client.on('ready', async () => {
  console.log(`[Discord] Connected to discord as ${Client.user.tag}`);
  Client.setTimeout(async () => {
    let channel = Client.channels.get(config.discord.verification_channel);
    DBManager.CorrectVotes();
    console.log("[Bot] Votes have been correctly updated!");
    let ver_fix = handler.fixVerification(channel);
    if(ver_fix)
      console.log("[Bot] Verifcation Messages have been recached and awaiting reactions.");
  }, 10000);
})

process.on("SIGINT", () => {
	console.log("[Process] Process has been called to shutdown! Shutting down Bot Instance and closing Database connection.");
  Client.destroy();
  Database.close();
});

Client.login(config.discord.token);