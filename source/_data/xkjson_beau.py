import json
with open("./source/_data/xiaokang.json","r") as cao:
    cao = json.load(cao)
with open("./source/_data/xiaokang.json","w") as ok:
    ok.write(json.dumps(cao, indent=2, separators=(',', ':')))