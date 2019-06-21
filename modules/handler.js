var path = require('path')

function handleDM(msg){
    
    if(msg.attachments.size > 1){
        createVerifcations(attachments, msg);
    }else if(msg.attachments.size == 1){
        let ver_channel = Client.channels.get(config.discord.verification_channel);
        let file = new Discord.Attachment(msg.attachments.array()[0].url, `VerificationCheck-${msg.author.username}_${msg.author.discriminator}${path.extname(msg.attachments.array()[0].url)}`);
        ver_channel.send(`**User**: ${msg.author.tag} (\`${msg.author.id}\`)`, { file: file }).then(vmsg => {
            msg.channel.send("Hey! Just confirming that we recieved your submission, and it is now undergoing a verification process.");
            let create_sql = `INSERT INTO Verification (user_id, dm_message_id, ver_message_id) VALUES (${msg.author.id}, ${msg.id}, ${vmsg.id})`;
            Database.run(create_sql);
            vmsg.react('✅').then(() => vmsg.react('⛔'));
            waitVerification(vmsg);
        });
    }
    return;
}
exports.handleDM = handleDM;

function createVerifcations(attachments, msg){
    let ver_channel = Client.channels.get(config.discord.verification_channel);
    attachments.forEach(attachment => {
        let file = new Discord.Attachment(attachment.url, `VerificationCheck-${msg.author.username}_${msg.author.discriminator}${path.extname(msg.attachments.array()[0].url)}`);
        ver_channel.send(`**User**: ${msg.author.tag} (\`${msg.author.id}\`)`, { file: file }).then(vmsg => {
            vmsg.react('✅').then(() => vmsg.react('⛔'));
            let create_sql = `INSERT INTO Verification (user_id, dm_message_id, ver_message_id) VALUES (${msg.author.id}, ${msg.id}, ${vmsg.id})`;
            Database.run(create_sql);
            waitVerification(vmsg, msg);
        });
    })
}

function checkUser(user, msg){
    var can_verify = false;
    let roles = Client.guilds.get(msg.guild.id).member(user).roles.array();
    roles.forEach(role => {
        if(config.discord.can_verify.indexOf(role.id))
            can_verify = true;
    })
    return can_verify;
}
exports.checkUser = checkUser;

async function waitVerification(vmsg){
    let filter = (reaction, user) => {
        return ['✅', '⛔'].includes(reaction.emoji.name) && checkUser(user.id, vmsg) && user.id != Client.user.id;
    };
    vmsg.awaitReactions(filter, { max: 1, maxUsers: 1 })
    .then(async collected => {
        const reaction = collected.first();
        let verifier = null;
        reaction.users.forEach(u => {
            if(u.id != Client.user.id)
                verifier = u.id
        });
        if (reaction.emoji.name === '✅') {
            vmsg.edit(`${vmsg.content}\n**Verified By**: <@${verifier}> \n\n*Submission Accepted! Please wait while I transfer it and notify the user!*`).then(async () => {
                let sub_channel = Client.channels.get(config.discord.submissions_channel);
                Database.run(`UPDATE Verification SET checked = true, accepted = true, verifier = ${verifier} WHERE ver_message_id = ${vmsg.id}`);
                let current = await Database.getAsync(`SELECT user_id FROM Verification WHERE ver_message_id = ${vmsg.id}`);
                let file = new Discord.Attachment(vmsg.attachments.array()[0].url, `Submission-${Client.users.get(current.user_id).username}_${Client.users.get(current.user_id).discriminator}${path.extname(vmsg.attachments.array()[0].url)}`);
                sub_channel.send(`**User**: <@${current.user_id}>`, { file: file }).then( sub_msg => {
                    sub_msg.react('✅');
                    Client.users.get(current.user_id).send(`Hello! I bring you good news. Your submission has been accepted and can be viewed here »\n**https://discordapp.com/channels/${sub_msg.guild.id}/${sub_msg.channel.id}/${sub_msg.id}**\n\nGood Luck!`);
                    Database.run(`INSERT INTO Submissions (user_id, verifier, message_id) VALUES (${current.user_id}, ${verifier}, ${sub_msg.id})`);
                });
            });
        }
        else if(reaction.emoji.name === '⛔') {
            vmsg.edit(`${vmsg.content}\n**Verified By**: <@${verifier}> \n\n*Submission Declined! User will be notified.*`).then(async () => {
                Database.run(`UPDATE Verification SET checked = true, accepted = false, verifier = ${verifier} WHERE ver_message_id = ${vmsg.id}`);
                let current = await Database.getAsync(`SELECT * FROM Verification WHERE ver_message_id = ${vmsg.id}`);
                Client.users.get(current.user_id).send(`Hello, sorry to be the bearer of bad news. It seems that your submission was declined at the verification step!`);
            })
        }
    })
}

async function updateSubmissionVotes(msg, add, reactor){
    let current = await Database.getAsync(`SELECT * FROM Submissions WHERE message_id = ${msg}`);
    if(current.user_id == reactor || reactor == Client.user.id) return;
    let votes = current.votes;
    if(add){
        votes++;
    }else{
        if(votes == 0) return;
        votes--;
    }
    Database.run(`UPDATE Submissions SET votes = ${votes} WHERE message_id = ${msg}`);
    return;
}
exports.updateSubmissionVotes = updateSubmissionVotes;


async function updateLeaderboard(leaderboard_data, channel){
    let message = await channel.fetchMessage(config.discord.leaderboard_message);
    let e = new Discord.RichEmbed();
    e.setColor(8592591);
    e.setTitle(config.leaderboard_title);
    e.setTimestamp(config.end_date);
    e.setFooter("Bot by Justin#1337 | Contest Ends on");

    description = [
        "\n",
    ];
    if(leaderboard_data.length == 0){
        description.push(`\`N/A\` **No Submissions Yet**`)
    }else{
        for(var x = 0; x < 10; x++){
            description.push(
                `\`${x + 1}.\` <@${leaderboard_data[x].user_id}> **${leaderboard_data[x].votes}** Votes | [**Click To View**](https://discordapp.com/channels/${message.guild.id}/${config.discord.submissions_channel}/${leaderboard_data[x].message_id})`
            )
            if(x + 1 >= leaderboard_data.length)
                break;
        }
    }
    description.push('\n');
    e.setDescription(description.join(`\n`));
    message.edit({embed: e});
    return true;
}
exports.updateLeaderboard = updateLeaderboard;

async function cmdLeaderboard(leaderboard_data, msg){
    let e = new Discord.RichEmbed();
    e.setColor(8592591);
    e.setTitle(config.leaderboard_title);
    e.setTimestamp(config.end_date);
    e.setFooter("Bot by Justin#1337 | Contest Ends on");

    description = [
        "\n",
    ];
    if(leaderboard_data.length == 0){
        description.push(`\`N/A\` **No Submissions Yet**`)
    }else{
        for(var x = 0; x < 10; x++){
            description.push(
                `\`${x + 1}.\` <@${leaderboard_data[x].user_id}> **${leaderboard_data[x].votes}** Votes | [**Click To View**](https://discordapp.com/channels/${msg.guild ? message.guild.id: config.discord.guild_id}/${config.discord.submissions_channel}/${leaderboard_data[x].message_id})`
            )
            if(x + 1 >= leaderboard_data.length)
                break;
        }
    }
    description.push('\n');
    e.setDescription(description.join(`\n`));
    msg.author.send({embed: e});
    msg.react('✅');
}
exports.cmdLeaderboard = cmdLeaderboard;

async function fixVerification(channel){
    var thing = false;
    let sql = `SELECT * FROM Verification WHERE checked = false`;
    let not_verified = await Database.getAllAsync(sql);
    if(not_verified.length == 0)
        return false;
    not_verified.forEach(async record => {
        let msg = await channel.fetchMessage(record.ver_message_id);
        waitVerification(msg);
        thing = true;
    })
    return thing;
}

exports.fixVerification = fixVerification;

async function forceUpdate(leaderboard_data){
    let msg = await Client.channels.get(config.discord.submissions_channel).fetchMessage(config.discord.leaderboard_message);
    let e = new Discord.RichEmbed();
    e.setColor(8592591);
    e.setTitle(config.leaderboard_title);
    e.setTimestamp(config.end_date);
    e.setFooter("Bot by Justin#1337 | Contest Ends on");

    description = [
        "\n",
    ];
    if(leaderboard_data.length == 0){
        description.push(`\`N/A\` **No Submissions Yet**`)
    }else{
        for(var x = 0; x < 10; x++){
            description.push(
                `\`${x + 1}.\` <@${leaderboard_data[x].user_id}> **${leaderboard_data[x].votes}** Votes | [**Click To View**](https://discordapp.com/channels/${message.guild.id}/${config.discord.submissions_channel}/${leaderboard_data[x].message_id})`
            )
            if(x + 1 >= leaderboard_data.length)
                break;
        }
    }
    description.push('\n');
    e.setDescription(description.join(`\n`));
    msg.edit({embed: e});
} 
exports.forceUpdate = forceUpdate;