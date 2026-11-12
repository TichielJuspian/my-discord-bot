# Gosu Bot 안전 회귀 테스트 (운영본 기준)

이 테스트는 **운영 BotKeep 백업의 코드**에서 추출해 작성했습니다. 실제 사용자 데이터를 사용하지 않습니다.

테스트 범위:
- 54개 시드/직업/보스 조합의 수동 입력 전투 결과 해시(수정 전 기준선 고정)
- 54개 자동 전투의 행동 유효성 및 종료 여부
- 레이드 포인트 순위/공동 순위/성공·실패 추가 포인트
- 중복·동시 레이드 포인트 지급 방지(메모리 DB 모형)
- 아이템·포션의 중복 지급 방지(임시 테스트 파일)
- 강화 가격·확률 범위 점검
- 레이드 테스트 초기화 실패 시 변경 차단과 성공적인 재시도
- 동시 초기화 호출 직렬화

실행: `node --test safety-tests/raid-combat-regression.test.cjs safety-tests/raid-economy-regression.test.cjs safety-tests/workshop-maintenance.test.cjs`

**주의:** Discord 네트워크와 실제 MongoDB를 연결한 통합 테스트는 아닙니다. `fixtures/raid-combat-baseline.json`을 임의로 재생성하면 전투 회귀 검증의 의미가 사라집니다. 승인된 게임 밸런스 변경 후에만 새 기준선을 검토해야 합니다.
