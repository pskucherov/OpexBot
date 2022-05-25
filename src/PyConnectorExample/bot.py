import sys
import json
import asyncio

token = sys.argv[1]
options = json.loads(sys.argv[2])

results = {
    'token': token,
    'options': options,
}

async def async_read_stdin()->str:
    loop = asyncio.get_event_loop()
    results.token = await loop.run_in_executor(None, sys.stdin.readline)
    print(str(results))

while(1):
    print(json.dumps(results, separators=(',', ':')))
    #async_read_stdin()
    #for line in sys.stdin:
    #    results.token = line.strip()
    #    print(str(results))

    sys.stdout.flush()
