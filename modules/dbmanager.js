function startDB(){
    let db = new sqlite3.Database('./database.db', (err) => {
        if (err) {
          console.error(err.message);
        }
        console.log('[DataBase] Database Loaded!'); 
    });
    db = DatabaseCheck(db);
    return db;
}
exports.startDB = startDB;

function DatabaseCheck(db){
    let Verification_sql = `create table if not exists Verification (user_id text, verifier text DEFAULT null, checked boolean DEFAULT false, dm_message_id text, ver_message_id text, accepted boolean DEFAULT null)`;
    let Submissions_sql = `create table if not exists Submissions (user_id text, votes int DEFAULT 0, verifier text DEFAULT null, message_id text)`;

    db.run(Verification_sql);
    db.run(Submissions_sql);
    return db;
}

async function GetLeaderboard(){
    let sql = `SELECT * FROM Submissions ORDER BY votes DESC`;
    let results = await Database.getAllAsync(sql);
    
    return(results);
}
exports.GetLeaderboard = GetLeaderboard;

async function CorrectVotes(){
    let getAll = `SELECT * FROM Submissions`;
    let channel = Client.channels.get(config.discord.submissions_channel);
    let submissions = await Database.getAllAsync(getAll);
    submissions.forEach(async sub => {
        let message = await channel.fetchMessage(sub.message_id);
        let count = message.reactions.get('✅').count;
        if(message.reactions.get('✅').users.get(sub.user_id))
            count--;
        updateSQL = `UPDATE Submissions SET votes = ${count - 1} WHERE message_id = ${sub.message_id}`;
        Database.run(updateSQL);
    });
}
exports.CorrectVotes = CorrectVotes;