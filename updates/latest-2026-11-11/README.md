# 최신 봇 작업본 / Latest bot work

이 폴더는 2026-11-11 UTC에 정리한 **최신 승인 작업본**입니다. 서버에 적용된 7개 파일과 대조한 기준 위에 최신 가격·비공개 포인트 조회 변경을 반영했습니다.

## 상태를 구분해주세요

- 최신 수정 코드는 `files/`의 8개 파일입니다. 이전 코드로 되돌린 버전이 아닙니다.
- 가격 변경과 `/pointtop`은 **아직 운영 서버에 배포되지 않았습니다**. 서버 저장·재시작·실제 Discord 동작 검증은 이 업로드에 포함되지 않습니다.
- 이것은 **완전한 독립 실행본이 아니라, 기존 운영 봇에 적용할 변경 파일 묶음**입니다. 전체 운영 소스와 이미지·폰트·기타 의존 파일은 이 저장소에서 전부 확보된 상태가 아닙니다.
- 저장소 루트의 `index.js`와 `package.json`은 이전 구현입니다. 이 폴더의 최신 변경과 혼동하거나 루트를 현재 운영본이라고 사용하지 마세요.
- 기존 main 및 기존 PR은 변경하지 않았습니다.

## 포함된 변경

1. MLBB 스킨: 45,000P → 90,000P. 상품 버전을 올려 이전 45,000P 미리보기 버튼으로 90,000P가 차감되지 않게 합니다.
2. 다른 판매 상품: 각 +2,000P. 일반 배경 21개, 애니 배경 40개, 현재 세트 27개, 배지 3개가 대상입니다. 무료 항목·판매하지 않는 구성 부품·보관 세트는 그대로입니다.
3. 기존 주문은 결제 당시 가격을 유지합니다. 기존 45,000P 주문의 환불도 45,000P이며 소유권·잔액·획득 포인트 규칙을 바꾸지 않습니다.
4. `/pointtop`: 지정 운영자만 현재 잔액 TOP 30과 스킨 구매까지 부족한 포인트를 비공개로 조회합니다. 페이지별 같은 스냅샷을 쓰며 10분 후 만료합니다.
5. `gift-entry.js`는 이미 수정한 privileged intent 재할당 및 freeze 처리를 유지하고 새 조회 기능을 연결합니다.

## 적용 전 확인

현재 운영 파일 7개를 `manifest.json`의 `baselineSha256`과 비교하세요. 새 변경이 있다면 전체 파일을 덮어쓰지 말고 차이를 검토해서 반영해야 합니다. 새 `point-balance-report.js`를 포함해 8개 파일 모두가 필요합니다.

이 묶음을 기존 봇 루트에 반영할 때만 사용하세요. 기존 환경 변수·MongoDB·캐릭터 상태·레이드 상태·보상 기록은 교체하거나 삭제하지 마세요. 코드의 기존 서버/운영자 ID 설정은 대상 서버용 그대로 유지되어 있습니다.

운영 반영과 재시작은 별도 단계입니다. 운영 로그 확인 경로가 복구되고 재시작 영향을 확인한 뒤 실행하고, 이후 실제 기능을 확인하세요. 이 폴더는 배포 성공을 주장하지 않습니다.

## 검증

- 8개 파일 `node --check` 통과.
- 가격/상품 23개 + 비공개 조회 8개 테스트 통과, 실패 0개.
- 업로드 파일 8개 모두 테스트한 파일과 바이트 단위로 동일.
- 테스트는 메모리/VM mock 기반입니다. 실제 Discord·MongoDB·운영 재시작은 테스트하지 않았습니다.
- `node verify.cjs`는 이 묶음의 SHA-256·크기·문법을 다시 검증합니다. 위 31개 동작 테스트를 대체하지 않습니다.

## 개인정보와 비밀정보

환경 파일, 토큰, DB, 회원 잔액/명단, 운영 JSON 상태, 로그, 캐시, 백업은 이 작업본에 넣지 않았습니다. 기존 저장소의 `Data/`도 이 브랜치에서는 제외했지만, 기존 main 및 과거 Git 기록을 삭제한 것은 아닙니다.

English: This is the latest approved source update, not an old snapshot. Its price and private balance-report changes are not deployed. It is an eight-file update for the existing production bot, not a complete runnable distribution. Do not use the legacy repository root as the current runtime. Preserve production credentials, databases and runtime state.
