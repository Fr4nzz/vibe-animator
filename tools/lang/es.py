"""Spanish caption conversion: spelled-out numbers -> digits (when >= 10, decimal, percent or a year), acronyms
spelled phonetically -> the acronym (map from episode.json captions.acronyms). Each shown token keeps the count of
spoken words it consumes, so caption timing stays word-exact.

Enable with  "captions": {"numbers": "es"}  in episode.json. To add a language, write lang/<code>.py with the same
convert(words, acronyms) signature.
"""
import re

UNITS = {"cero": 0, "uno": 1, "un": 1, "una": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5, "seis": 6, "siete": 7,
         "ocho": 8, "nueve": 9, "diez": 10, "once": 11, "doce": 12, "trece": 13, "catorce": 14, "quince": 15,
         "dieciséis": 16, "diecisiete": 17, "dieciocho": 18, "diecinueve": 19, "veinte": 20, "veintiuno": 21, "veintiún": 21,
         "veintidós": 22, "veintitrés": 23, "veinticuatro": 24, "veinticinco": 25, "veintiséis": 26, "veintisiete": 27,
         "veintiocho": 28, "veintinueve": 29}
TENS = {"treinta": 30, "cuarenta": 40, "cincuenta": 50, "sesenta": 60, "setenta": 70, "ochenta": 80, "noventa": 90}
HUND = {"cien": 100, "ciento": 100, "doscientos": 200, "doscientas": 200, "trescientos": 300, "trescientas": 300,
        "cuatrocientos": 400, "quinientos": 500, "seiscientos": 600, "setecientos": 700, "ochocientos": 800, "novecientos": 900}
NUMW = set(UNITS) | set(TENS) | set(HUND) | {"mil", "y", "punto"}
PUNCT = re.compile(r"^([¿¡(«\"']*)(.*?)([.,;:?!…)»\"']*|\.\.\.)$")

def split(w):
    m = PUNCT.match(w); return m.group(1), m.group(2), m.group(3)

def parse_int(ws):
    """ws: list of bare lowercase words forming an integer. Returns int or None."""
    total, cur, i = 0, 0, 0
    while i < len(ws):
        w = ws[i]
        if w in HUND: cur += HUND[w]
        elif w in TENS:
            cur += TENS[w]
            if i + 1 < len(ws) and ws[i + 1] == "y":
                if i + 2 < len(ws) and ws[i + 2] in UNITS and UNITS[ws[i + 2]] < 10:
                    if i + 3 < len(ws) and ws[i + 3] in (set(UNITS) | set(TENS) | set(HUND)):
                        return None  # "treinta y un ochenta": range with an article, not 31 + 80
                    cur += UNITS[ws[i + 2]]; i += 2
                else:
                    return None
        elif w in UNITS:
            if i + 1 < len(ws) and ws[i + 1] in (set(UNITS) | set(TENS) | set(HUND)):
                return None  # "un treinta y cinco": article + number, not addition
            cur += UNITS[w]
        elif w == "mil": total += (cur or 1) * 1000; cur = 0
        elif w == "y": return None
        else: return None
        i += 1
    return total + cur

def number_run(words, i):
    """Longest number expression starting at i. Returns (shown, consumed) or None."""
    best = None
    for j in range(i + 1, min(len(words), i + 9) + 1):
        bare = [split(w)[1].lower() for w in words[i:j]]
        if any(b not in NUMW for b in bare) or bare[0] in ("y", "punto"):
            break
        if bare[-1] in ("y", "punto"):
            continue
        if any(split(w)[2] for w in words[i:j-1]):  # punctuation inside -> stop
            break
        if "punto" in bare:
            k = bare.index("punto"); a, b = parse_int(bare[:k]), bare[k+1:]
            if a is None or not b: continue
            frac = parse_int(b) if len(b) > 1 or b[0] not in UNITS else UNITS[b[0]]
            if frac is None: continue
            # "punto cero cinco" style: digits spoken one by one
            if b[0] == "cero": frac_s = "".join(str(UNITS[x]) for x in b if x in UNITS)
            else: frac_s = str(frac)
            val_s, isnum = f"{a}.{frac_s}", True
        else:
            v = parse_int(bare)
            if v is None: continue
            val_s = f"{v:,}".replace(",", " ") if v >= 10000 else str(v)
        best = (val_s, j - i)
    return best

def convert(words, acronyms):
    """[spoken words] -> [[shown, n spoken words]]: numbers >= 10, decimals, percentages and years as digits."""
    out, i = [], 0
    while i < len(words):
        pre, core, post = split(words[i]); low = core.lower()
        if low in acronyms:
            out.append([pre + acronyms[low] + post, 1]); i += 1; continue
        nr = number_run(words, i) if low in NUMW else None
        if nr:
            val, n = nr
            pre0 = split(words[i])[0]; post_last = split(words[i + n - 1])[2]
            nxt = [split(w)[1].lower() for w in words[i + n:i + n + 2]]
            is_pct = nxt[:2] == ["por", "ciento"]
            numeric = "." in val
            try: iv = int(val.replace(" ", "")) if not numeric else None
            except ValueError: iv = None
            show_digits = numeric or is_pct or (iv is not None and iv >= 10)
            if show_digits:
                if is_pct:
                    post_last = split(words[i + n + 1])[2]
                    out.append([pre0 + val + " %" + post_last, n + 2]); i += n + 2; continue
                out.append([pre0 + val + post_last, n]); i += n; continue
        out.append([words[i], 1]); i += 1
    return out

