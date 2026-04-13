import os
import re

def find_emojis(directory):
    emoji_pattern = re.compile(
        "["
        u"\U0001F600-\U0001F64F"  # emoticons
        u"\U0001F300-\U0001F5FF"  # symbols & pictographs
        u"\U0001F680-\U0001F6FF"  # transport & map symbols
        u"\U0001F700-\U0001F77F"  # alchemical symbols
        u"\U0001F780-\U0001F7FF"  # Geometric Shapes Extended
        u"\U0001F800-\U0001F8FF"  # Supplemental Arrows-C
        u"\U0001F900-\U0001F9FF"  # Supplemental Symbols and Pictographs
        u"\U0001FA00-\U0001FA6F"  # Chess Symbols
        u"\U0001FA70-\U0001FAFF"  # Symbols and Pictographs Extended-A
        u"\u2600-\u26FF"          # miscellaneous symbols
        u"\u2700-\u27BF"          # dingbats
        "]+", flags=re.UNICODE)

    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.tsx'):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    matches = emoji_pattern.finditer(content)
                    found = False
                    for match in matches:
                        if not found:
                            print(f"\n--- {file} ---")
                            found = True
                        line = content[:match.start()].count("\n") + 1
                        print(f"Line {line}: Found emoji {match.group()}")

find_emojis('c:/Users/ASUS/Desktop/mizan formulation/frontend/src/app')
find_emojis('c:/Users/ASUS/Desktop/mizan formulation/frontend/src/components')
