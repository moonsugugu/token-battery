# 릴스용 위젯 화면 캡처: 장면 목록(steps)을 만들고 Electron 캡처 모드로 카드만 잘라 frames/ 에 저장한다.
# 사용: python tools/reel/capture.py <앱 실행 폴더(영문 경로)> <출력 폴더>
import json, os, subprocess, sys, time

app_dir, out_dir = sys.argv[1], sys.argv[2]
os.makedirs(out_dir, exist_ok=True)
H, D = 3600_000, 86400_000


def use(c5, x5, cw=24, xw=38, cr5=int(1.9 * H), xr5=int(3.4 * H), crw=int(4.2 * D), xrw=int(2.8 * D)):
    return dict(c5=c5, x5=x5, cw=cw, xw=xw, cr5=cr5, xr5=xr5, crw=crw, xrw=xrw)


FRESH = use(18, 10)
steps = []
# 0~2초 훅: 한도가 줄며 표정이 바뀌는 캐릭터 (애니 테마)
for i, (c5, x5) in enumerate([(12, 8), (48, 35), (80, 74), (94, 92), (100, 100)], 1):
    steps.append(dict(out=f'hook_{i}.png', theme='anime', mode='full', sel='#crew', usage=use(c5, x5, cw=40 + i * 10, xw=35 + i * 11)))
# 2~5초 세계관: 카페 여우와 공부 로봇
steps.append(dict(out='world.png', theme='mascot', mode='char', usage=FRESH))
# 5~12초 기능 컷 7개
steps.append(dict(out='f1_mini.png', theme='cyber', mode='mini', usage=use(42, 28)))
steps.append(dict(out='f2_char.png', theme='garden', mode='char', usage=use(55, 30)))
steps.append(dict(out='f3_full.png', theme='glass', mode='full', usage=use(22, 66)))
for i, (c5, x5) in enumerate([(20, 10), (55, 40), (82, 70), (96, 93)], 1):
    steps.append(dict(out=f'f4_drop_{i}.png', theme='cyber', mode='full', sel='#crew', usage=use(c5, x5, cw=30 + i * 12, xw=40 + i * 10)))
steps.append(dict(out='f5_alert.png', theme='industrial', mode='char', usage=use(86, 45)))
steps.append(dict(out='f6_subs.png', theme='engine', mode='full', sel='#card', usage=use(30, 20),
                  js="['crew','claudeNote','recover'].forEach(i=>{const e=document.getElementById(i); if(e){(e.closest('.rowcard')||e).style.display='none'}}); document.querySelector('.sechead').style.display='none'; document.getElementById('subsFold').open=true; fit();",
                  wait=1400))
steps.append(dict(out='f7_bgm.png', theme='arcade', mode='full', usage=use(35, 25),
                  js="document.getElementById('ctaMenu').classList.remove('hidden');", wait=1100))
# 12~16초 디자인 10종 몽타주
for th in ['cyber', 'engine', 'mascot', 'arcade', 'glass', 'crt', 'industrial', 'garden', 'anime', 'editorial']:
    steps.append(dict(out=f'm_{th}.png', theme=th, mode='full', usage=use(28, 46)))

# 장면마다 이전 장면에서 바꾼 화면 상태를 되돌린다
RESET = ("document.querySelectorAll('#card [style]').forEach(e=>{ if(e.style.display==='none') e.style.display=''; });"
         "document.getElementById('subsFold').open=false; document.getElementById('ctaMenu').classList.add('hidden');"
         "document.getElementById('settings').classList.add('hidden'); fit();")
for st in steps:
    st['js'] = RESET + st.get('js', '')
spec = dict(outDir=out_dir, steps=steps)
spec_path = os.path.join(out_dir, 'steps.json')
json.dump(spec, open(spec_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# 캡처 전용 설정(실제 설정과 분리된 임시 폴더)
snap = os.path.join(os.environ['TEMP'], 'token-battery-snapshot')
os.makedirs(snap, exist_ok=True)
now = int(time.time() * 1000)
store = dict(
    lang='ko', basis='remain', theme='anime', mode='char', hotkeys=dict(toggle='', full=''),
    scale=dict(mini=2.4, char=1.6, full=1),
    subscriptions=[
        dict(id='a', name='Claude', plan='Pro', price=22, currency='USD', day=1, memo=''),
        dict(id='b', name='ChatGPT', plan='Plus', price=20, currency='USD', day=3, memo=''),
        dict(id='c', name='Cursor', plan='Pro', price=20, currency='USD', day=12, memo=''),
        dict(id='d', name='Midjourney', plan='Basic', price=10, currency='USD', day=20, memo=''),
    ],
    history=dict(claude={str(now // H - 168): 71, str(now // H - 336): 80}, codex={str(now // H - 168): 44}),
    alertsOn=False,
)
json.dump(store, open(os.path.join(snap, 'widget-store.json'), 'w', encoding='utf-8'), ensure_ascii=False)

env = dict(os.environ, WIDGET_SNAPSHOT=os.path.join(out_dir, '_last.png'), WIDGET_SNAPSHOT_STEPS=spec_path, WIDGET_SNAPSHOT_SCALE='1.8')
exe = os.path.join(app_dir, 'node_modules', 'electron', 'dist', 'electron.exe')
p = subprocess.run([exe, app_dir, '--no-sandbox'], env=env, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=300)
print('\n'.join(l for l in p.stdout.splitlines() if l.startswith('[step]')))
print('captured', len([f for f in os.listdir(out_dir) if f.endswith('.png')]), 'png')
