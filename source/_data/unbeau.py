import json
with open("./source/_data/twikoo.json","r") as twikoo:
    twikoo = json.load(twikoo)
with open("./public/owo.json","w") as owo:
    owo.write(json.dumps(twikoo))