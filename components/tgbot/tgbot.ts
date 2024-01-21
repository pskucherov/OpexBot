import TelegramBot from 'node-telegram-bot-api';

let bot: TelegramBot | undefined;

function createTgBot(token: string, userid: TelegramBot.ChatId) {
    if (!token) {
        return;
    }

    if (bot) {
        return bot;
    }

    try {
        bot = new TelegramBot(token, { polling: true });

        bot.on('polling_error', async _error => {
            // await bot.close();
            bot = undefined;
        });

        if (userid) {
            // @ts-ignore
            bot.sendMessage = bot?.sendMessage.bind(bot, userid);

            // bot?.sendMessage('OpexBot подключен к tg');
        }

        // bot?.on('message', msg => {
        //     if (userid) {
        //         bot?.sendMessage('bot message opextinkoffbot: ' + JSON.stringify(msg, null, 4));
        //     }
        // });

        return bot;
    } catch (e) {
        console.log(e); // eslint-disable-line no-console
    }

    return undefined;
}

module.exports = {
    createTgBot,
};
