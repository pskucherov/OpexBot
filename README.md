# OpexBot

**appname: pskucherov.tinkofftradingbot**

## Требования
```
node >= 17
```

> В node v17 есть предустановки MSVC и node-gyp, что сильно упростит использовании GPU для машинного обучения.
> Это пока в планах, но чтобы в будущем не тратить время на обновления и обратную совместимость, сразу зафиксировал минимальную версию ноды.

## Установка и запуск

### Из npm
```
mkdir robot
cd robot
npm i opexbot
npx opexbot
```

### Из репозитория
```
git clone https://github.com/pskucherov/OpexBot
cd OpexBot
npm i
npm start
```

### Порты
По умолчанию используются 3000 и 8000 порты. Для их изменения используйте PORT и SERVERPORT соответственно.
```
PORT=3006 SERVERPORT=8006 npx opexbot
```

## UI
После старта откройте http://localhost:3000/settings

Вся дальнейшая настройка и взаимодействие с роботом через UI.

Подробности в репозитории терминала: [https://github.com/pskucherov/OpexViewer/](https://github.com/pskucherov/OpexViewer/#возможности)

## Модули
1. [SDK](https://www.npmjs.com/package/tinkoff-sdk-grpc-js) (forked from mtvkand/invest-nodejs-grpc-sdk)
> В основной репозиторий добавил appname, обновил proto и список ошибок, добавил возможность проброса метода для логирования ([раз](https://github.com/mtvkand/invest-nodejs-grpc-sdk/pull/3/commits), [два](https://github.com/mtvkand/invest-nodejs-grpc-sdk/pull/7/commits)). В форке привёл экспорт к нужному мне виду и вынес в npm.

2. [TinkoffTradingBotConnector](https://www.npmjs.com/package/tinkofftradingbotconnector)
> Библиотека, связывающая терминал, sdk и робота. Ведёт журнал логов по дням, кеширует данные от брокера и сохраняет настройки из терминала.

3. [OpexViewer](https://www.npmjs.com/package/opexviewer)
> Пользовательский инетрфейс для бектестирования и дневной торговли.

4. Непосредственно сам [робот](https://www.npmjs.com/package/opexbot)
> Состоит из основного класса обработки данных Common, наследуемого от него Backtest для обработки данных в режиме бектестирования и класса робота, в котором реализуется торговая стратегия. Настройки робота сохраняются для каждого инструмента отдельно.

## Пример создания робота
1. Копируем папку [Example](src/Example), кладём рядом и переименовываем в название робота.
> После этого этапа робот автоматически подключится в OpexViewer и будет доступен в селекте роботов.

<img src="https://user-images.githubusercontent.com/3197868/169850915-cf7e65d3-b120-408b-96d3-86eb52d21a37.png" height="300">

2. Пишем бизнес логику в заготовленных блоках. В примере уже описаны основные команды, это решения про сделку и обработка самих сделок.
Эти методы обходятся с заданным интервалом и выполняются в зависимости от условий. Полный список переменных и методов, которыми оперирует робот и доступны для использования, можно посмотреть на [дебаг странице](http://localhost:8000/robots/debug). Дебаг страница доступна только для запущенного робота, т.к. выводится его содержимое в реальном времени.
                                                                                                                        
<img src="https://user-images.githubusercontent.com/3197868/169852077-ae5ad9df-66e7-47c7-82bd-e2cf043c2c07.png" height="300" >

И получается лаконичный робот, в котором нет ничего лишнего. [Пример робота](https://github.com/pskucherov/OpexBot/blob/main/src/SupportResistance/index.js), который торгует от уровня поддержки и закрывает сделки по takeProfit.

## Оригинальное использование

1. Пошаговое бектестирование и отладка робота.

2. Кеширование стакана для анализа торгов, бектестирования и создания новых роботов.
> Когда робот запущен, то все заявки, сделки и стакан сохраняются в файл. При выборе робота для бектестирования в эту дату для заданного инструмента все данные восстанавливаются и можно проанализировать поведение робота. А так же отладить его на сохранённом стакане.

Примеры
* [закешированные заявки и трейды](https://github.com/pskucherov/OpexBot/blob/3805bbb08fe4ff4e7a28ec0ad4924937c2931459/orders/RandomExample/2125297396/BBG004730N88/18.05.2022.json) 
* [закешированный](https://github.com/pskucherov/TinkoffTradingBotConnector/blob/abfbf643a8a5341e892d01095b7fffcce3e07afb/data/cachedorderbooks/BBG004730N88/18.05.2022.json) и [сжатый](https://github.com/pskucherov/TinkoffTradingBotConnector/blob/abfbf643a8a5341e892d01095b7fffcce3e07afb/data/cachedorderbooks/BBG004730N88/18.05.2022compressed.json) стаканы. Полный кеш стакана можно использовать для машинного обучения. Сжатый схлопнут до минут и используется для отрисовки на графике.

Всё вместе это выглядит так:

<img src="https://user-images.githubusercontent.com/3197868/169780431-d669cdbb-958c-46f7-9688-024706eae13d.png" height="300">

3. Создание и подключение робота в два шага. Не нужно трогать окружение, робот сам в него встраивается. Все переменные и методы доступны из коробки.
