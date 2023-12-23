// https://articles.opexflow.com/trading-training/kak-poluchit-token-dlya-tinkoff-investicii.htm
// Для игнорирования файла в git (чтобы случайно не закоммитить):
// git update-index --assume-unchanged config.ts
const TOKEN = '';

if (!TOKEN) {
    throw 'Заполните токен в файле config.ts';
}

export {
    TOKEN,
};
