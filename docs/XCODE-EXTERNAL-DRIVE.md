# Xcode 캐시 외장하드(`marcus`)로 옮기기

Mac 내장 디스크 용량을 줄이기 위해 **Xcode 앱은 그대로 두고**, 용량이 큰 캐시·산출물만 외장하드로 옮기는 방법입니다.

> **외장하드 경로 예시:** `/Volumes/marcus`  
> 드라이브 이름이 다르면 아래 명령의 경로만 바꿉니다.

## 옮기지 말아야 할 것

| 항목 | 이유 |
|---|---|
| `Xcode.app` (`/Applications`) | `xcode-select`, SDK, CLI tools와 꼬일 수 있음 |
| `~/Library/Developer/CommandLineTools` | 시스템 빌드 도구 |

## 옮겨도 되는 것 (용량 큰 순)

| 폴더 | 대략 용량 | 설명 |
|---|---|---|
| `~/Library/Developer/Xcode/iOS DeviceSupport` | 수 GB | 실기기 연결 시 생성, 필요 시 재다운로드 |
| `~/Library/Developer/CoreDevice` | ~4KB (실제) | 실기기 연결 시 `DeviceFS` **마운트 지점**. `du`만 보면 수 GB처럼 보이지만 대부분 연결된 기기 파일시스템이라 **내장 디스크 절약 효과는 거의 없음** |
| `<프로젝트>/ios/build` | 수 GB | 프로젝트 빌드 산출물, 삭제·재생성 가능 |
| `~/Library/Developer/Xcode/DerivedData` | 수 GB | Xcode 빌드 캐시, **가장 안전하게 옮길 항목** |
| `~/Library/Developer/Xcode/Archives` | 가변 | 배포용 아카이브 (있을 때만) |

현재 Mac에서 용량 확인:

```bash
du -sh ~/Library/Developer/Xcode/DerivedData \
  ~/Library/Developer/Xcode/iOS\ DeviceSupport \
  ~/Library/Developer/Xcode/Archives \
  ~/Library/Developer/CoreDevice \
  ~/Library/Developer/CoreSimulator 2>/dev/null
```

외장하드 여유 확인:

```bash
df -h /Volumes/marcus
```

## 공통 준비

1. **Xcode 완전히 종료** (실행 중이면 `Cmd+Q`)
2. 외장하드 **`marcus` 연결** 확인
3. 터미널에서 아래 명령 실행

---

## 1. DerivedData (추천)

```bash
mkdir -p "/Volumes/marcus/Xcode/DerivedData"
mv ~/Library/Developer/Xcode/DerivedData "/Volumes/marcus/Xcode/DerivedData"
ln -s "/Volumes/marcus/Xcode/DerivedData" ~/Library/Developer/Xcode/DerivedData
```

## 2. iOS DeviceSupport (용량 많이 확보)

```bash
mkdir -p "/Volumes/marcus/Xcode/iOS DeviceSupport"
mv ~/Library/Developer/Xcode/iOS\ DeviceSupport "/Volumes/marcus/Xcode/iOS DeviceSupport"
ln -s "/Volumes/marcus/Xcode/iOS DeviceSupport" ~/Library/Developer/Xcode/iOS\ DeviceSupport
```

## 3. Archives (있을 때만)

```bash
mkdir -p "/Volumes/marcus/Xcode/Archives"
mv ~/Library/Developer/Xcode/Archives "/Volumes/marcus/Xcode/Archives"
ln -s "/Volumes/marcus/Xcode/Archives" ~/Library/Developer/Xcode/Archives
```

## 4. CoreDevice (실기기 디버깅 — 용량 절약 효과 낮음)

`DeviceFS`는 **폴더가 아니라 마운트 포인트**입니다. iPhone/iPad가 연결되면 `CoreDeviceService`가 여기에 기기 파일시스템을 붙입니다.  
`du ~/Library/Developer/CoreDevice`는 연결된 기기 용량까지 합산해 **수 GB처럼 보일 수 있지만**, 내장 디스크 실사용은 보통 **수 KB**입니다 (`du -sh -x ~/Library/Developer/CoreDevice`로 확인).

**용량 확보 목적이라면 CoreDevice 이전은 우선순위가 낮습니다.** DerivedData·DeviceSupport를 먼저 옮기세요.

그래도 경로를 외장으로 맞추려면 **기기 연결 해제 + Xcode 종료** 후:

```bash
killall CoreDeviceService DeviceFS 2>/dev/null
diskutil unmount force ~/Library/Developer/CoreDevice/DeviceFS

# 잘못 만들어진 외장 중첩 폴더 정리 (있을 때)
rm -rf "/Volumes/marcus/Xcode/CoreDevice/CoreDevice"

# 내장 폴더 제거 후 symlink (DeviceFS 마운트 지점은 외장에서 다시 생성됨)
rmdir ~/Library/Developer/CoreDevice/DeviceFS 2>/dev/null
rmdir ~/Library/Developer/CoreDevice 2>/dev/null
mkdir -p "/Volumes/marcus/Xcode/CoreDevice"
ln -s "/Volumes/marcus/Xcode/CoreDevice" ~/Library/Developer/CoreDevice
```

`Operation not permitted` / `Resource busy`가 나오면 iPhone·iPad **USB 분리** 후 다시 시도하세요.  
외장에 `CoreDevice` 폴더가 **이미 있을 때** `mv … /Volumes/marcus/Xcode/CoreDevice`로 옮기면 **안쪽에 중첩**되므로, 위처럼 `mkdir` + `ln -s`만 사용합니다.

## 5. SignalApp `ios/build` (프로젝트별)

기존 빌드 캐시를 지우고 외장하드에 symlink:

```bash
rm -rf /Users/marcusmoon/SignalApp/ios/build
mkdir -p "/Volumes/marcus/Xcode/SignalApp-ios-build"
ln -s "/Volumes/marcus/Xcode/SignalApp-ios-build" /Users/marcusmoon/SignalApp/ios/build
```

---

## symlink 확인

```bash
ls -la ~/Library/Developer/Xcode/DerivedData
ls -la ~/Library/Developer/Xcode/iOS\ DeviceSupport
ls -la ~/Library/Developer/CoreDevice
```

`DerivedData -> /Volumes/marcus/Xcode/DerivedData` 형태면 정상입니다.  
`CoreDevice`도 `CoreDevice -> /Volumes/marcus/Xcode/CoreDevice`이어야 하며, **그 안에 또 `CoreDevice` 링크가 있으면** 위 §4 복구 절차를 따릅니다.

## 되돌리기

외장하드에서 다시 내장 디스크로 옮길 때:

```bash
# 예: DerivedData
rm ~/Library/Developer/Xcode/DerivedData
mv "/Volumes/marcus/Xcode/DerivedData" ~/Library/Developer/Xcode/DerivedData
```

## 주의사항

- **빌드·아카이브·실기기 디버깅 시 외장하드가 연결되어 있어야** 합니다. 분리된 상태에서 Xcode를 열면 캐시를 찾지 못하거나 다시 생성됩니다.
- `~/Library/Developer` 폴더 자체는 symlink하지 마세요. **DerivedData, DeviceSupport, CoreDevice** 등 개별 하위 폴더만 옮깁니다.
- USB보다 **Thunderbolt / USB-C SSD**가 빌드 속도에 유리합니다.
- `ReactCodegen` 등 codegen 파일 missing 오류가 나면: Xcode 종료 → `ios/build` 삭제 → `cd ios && pod install` → `npm run ios`로 한 번 재빌드하세요.

## Xcode 설정 (선택)

Xcode → **Settings → Locations**에서 **Derived Data** 경로를 직접 `/Volumes/marcus/Xcode/DerivedData`로 지정할 수도 있습니다. symlink와 중복 설정하지 마세요.
