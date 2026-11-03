# Gen Bot 개인정보처리방침


작성 기준일: 2026년 11월 1일 · 대상: Gen Bot#5885 (애플리케이션 ID 978897570522869800)
운영 및 개인정보 문의: Discord **@gosugeneral**


이 방침은 Gosu General TV 커뮤니티에서 사용하는 Gen Bot이 Discord API를 통해 처리하는 정보와 이용자의 요청 방법을 설명합니다. Discord 자체의 데이터 처리에는 Discord의 개인정보처리방침이 별도로 적용됩니다.


## 1. 처리하는 정보


봇은 권한이 허용된 범위에서 서버·채널·사용자 ID, 사용자 이름과 프로필 이미지, 역할 정보, 서버 가입·탈퇴 및 역할 변경 이벤트, 음성 채널 참여 상태, 명령어와 버튼 입력을 처리합니다. 메시지 필터와 경험치 기능을 위해 봇이 볼 수 있는 서버 메시지 및 작성자 정보를 처리합니다.


MongoDB에는 서버 ID, 사용자 ID, 경험치와 레벨, 로그·환영 채널 등 봇 설정, 금지어 목록을 저장합니다. 일반 메시지 본문을 MongoDB에 지속 저장하는 기능은 현재 코드에 없습니다. 실행 중에는 Discord 라이브러리의 메모리 캐시에 메시지 등 API 데이터가 일시적으로 남을 수 있습니다.


## 2. 이용 목적


경험치·랭킹·레벨 역할 제공, 환영 메시지, 역할 및 인증 패널, VIP 역할 변경 안내, 임시 음성 채널 관리, 사기성 링크·금지어·링크 제한 검사, 운영진의 관리 명령 수행 및 서버 관리 로그에 이용합니다. 이용자의 메시지나 API 데이터를 광고 타기팅, 판매 또는 AI·기계학습 모델 학습에 사용하지 않습니다.


## 3. 삭제 메시지와 관리 로그


관리자가 메시지 로그 채널을 설정한 경우, 삭제된 메시지의 이용 가능한 본문, 작성자 이름·ID·프로필 이미지, 채널 및 기록 시각이 해당 Discord 채널에 다시 게시될 수 있습니다. 원본 메시지를 삭제해도 이 로그 사본이 자동 삭제되지는 않습니다. 가입·탈퇴, 역할 변경 안내와 관리 조치 관련 정보도 설정된 Discord 채널에 게시될 수 있습니다. 로그를 볼 수 있는 사람은 해당 채널의 Discord 접근 권한에 따릅니다.


## 4. 저장 위치와 접근


봇 실행 호스팅에는 Botkeep을 사용하며, 이전 호스팅 Quaxly에 전환 전 코드·설정 사본이 남아 있을 수 있습니다. 지속 데이터는 운영자가 설정한 MongoDB 서비스에 저장합니다. Discord, 호스팅 및 데이터베이스 제공자는 서비스 제공에 필요한 범위에서 관련 데이터를 처리할 수 있습니다. 운영자는 봇 유지관리와 이용자 요청 처리에 필요한 범위에서 저장 데이터에 접근합니다. 각 제공자의 인프라와 설정에 따라 데이터가 이용자 거주 국가 외에서 처리될 수 있습니다.


## 5. 보관과 삭제


경험치와 레벨 데이터는 서비스 제공에 필요한 동안 보관하며, 이용자 요청 또는 더 이상 필요하지 않은 경우 삭제합니다. 현재 코드는 고정된 기간에 따른 자동 만료나 서버 탈퇴 시 자동 삭제를 구현하지 않습니다. 따라서 30일 이내 자동 삭제를 보장하지 않습니다. Discord에 게시된 로그와 제공자 측 백업은 원본 데이터와 별도로 남을 수 있으며, 요청 시 삭제 가능 범위와 제한을 안내합니다.


## 6. 이용자의 요청 방법


정보 확인·정정·삭제 또는 처리 관련 문의는 Discord **@gosugeneral**에게 DM으로 보내주세요. DM을 보낼 수 없다면 Gosu General TV 서버 운영진을 통해 해당 계정에 전달을 요청할 수 있습니다. 요청 시 본인 Discord 사용자 ID와 관련 서버, 원하는 조치를 알려주세요. 비밀번호, 봇 토큰 또는 다른 로그인 비밀정보는 보내지 마세요.


운영자는 필요한 범위에서 본인 확인 후 요청을 검토하고 처리 결과 또는 처리할 수 없는 사유를 안내합니다. 경험치 삭제는 기존 레벨과 랭킹에 영향을 줄 수 있습니다. 현재 별도의 이용자별 자동 수집 거부 명령은 없습니다. 삭제 후에도 봇이 접근 가능한 채널에서 활동하면 관련 데이터가 다시 생성될 수 있으므로, 향후 처리 제한도 원한다면 함께 요청해주세요. 서버 관리자는 채널 권한 제한이나 봇 제거로 접근을 제한할 수 있습니다.


## 7. 보안


봇 인증정보와 데이터베이스 접속정보는 공개 코드에 포함하지 않고 비밀 설정으로 관리합니다. 이용자 데이터 접근은 서비스 운영에 필요한 범위로 제한합니다. 이 방침은 확인되지 않은 데이터베이스 저장 시 암호화 설정이나 보안 인증을 보증하지 않습니다.


## 8. 변경과 연락처


봇 기능이나 데이터 처리 방식이 바뀌면 이 방침을 갱신하고 중요한 변경은 서버 공지 등 적절한 방법으로 안내합니다. 최신 방침 및 문의 연락처: Discord **@gosugeneral**.



# Gen Bot Privacy Policy


Prepared: November 1, 2026 · Gen Bot#5885 · Application ID: 978897570522869800
Operator and privacy contact: Discord **@gosugeneral**


This policy describes data processed by Gen Bot for the Gosu General TV community. Discord's own processing is governed separately by its privacy policy.


## Data and purposes


Within its Discord permissions, the bot processes server, channel and user IDs; usernames and avatars; roles; member join, leave and role-change events; voice-channel participation; commands and button inputs; and accessible server messages and their authors. These support XP, rankings, level roles, welcomes, role and verification panels, VIP notifications, temporary voice channels, scam/link/prohibited-word filtering, moderator commands and server logs.


MongoDB stores server and user IDs, XP and levels, bot configuration such as log and welcome channel IDs, and the prohibited-word list. Current code does not persist ordinary message bodies in MongoDB. Discord-library memory caches may temporarily hold messages and other API data during operation. API data and message content are not sold or used for advertising targeting or training AI or machine-learning models.


## Discord logs


When a message-log channel is configured, available deleted-message text, author name/ID/avatar, channel and log timestamp may be reposted there. Deleting the original message does not automatically delete this log copy. Member events, role notifications and moderation information may also be posted to configured Discord channels. Visibility follows those channels' Discord permissions.


## Storage, access and retention


Botkeep is used for bot hosting; the previous host Quaxly may retain pre-migration code and configuration copies. Persistent data is stored in the operator-configured MongoDB service. Discord and infrastructure providers may process data to provide their services. The operator accesses stored data as needed for maintenance and user requests. Depending on provider infrastructure and configuration, processing may take place outside a user's country.


XP and level records are retained while needed for the service and deleted on request or when no longer needed. Current code has no fixed automatic expiration or automatic deletion when a member leaves; deletion within 30 days is not guaranteed. Discord log copies and provider backups may persist separately. Available deletion scope and limitations will be explained when handling a request.


## Your requests


For access, correction, deletion or processing questions, DM Discord **@gosugeneral**. If DMs are unavailable, ask Gosu General TV moderators to relay the request to that account. Include your Discord user ID, relevant server and requested action. Never send passwords, bot tokens or login secrets. The operator reviews requests after proportionate identity verification and explains the outcome or any inability to fulfill them.


Deleting XP may affect levels and rankings. There is currently no automated per-user opt-out command. Continued activity in channels accessible to the bot may create new records after deletion, so specify if you also want future processing restricted. Server administrators can restrict channel access or remove the bot.


## Security and changes


Bot and database credentials are managed as secret settings rather than public source code, and data access is limited to operational needs. This policy does not certify unverified database encryption-at-rest settings or security certifications. The policy will be updated when processing changes, with material changes announced through suitable server notices. Contact: Discord **@gosugeneral**.


## VVIP 스킨 신청과 비공개 티켓 / VVIP skin requests and private tickets

VVIP 신청 기능은 Discord·YouTube 채널 ID와 MLBB 게임 ID·Zone ID를 연결하고, 신청한 상품·입력한 다이아 가격·확인된 멤버십 이용 기간·회원이 제공해 확인한 다음 갱신 예정일·운영자의 확인 및 지급 기록을 저장합니다. 결제 참조는 중복 확인을 위한 해시만 저장하며, 카드정보나 비밀번호를 요구하지 않습니다. 정확한 결제일을 자동 조회하지 않으며, 갱신 예정일만으로 새 신청 기회를 부여하지 않습니다.

신청 채널과 개인별 비공개 티켓을 운영하며 티켓 ID, 역할·채널 설정, 추가 지급 내역과 사유, 처리한 운영자 ID, 환영 알림 삭제 예정 시각 등을 저장합니다. 티켓과 검토 기록은 신청자에게 허용된 범위 및 설정된 운영진·관리자·봇 권한에 따라 Discord에 표시됩니다. 티켓 메시지·첨부한 확인 자료는 Discord에 남으며 MongoDB에 일반 티켓 본문이나 원본 결제 증빙을 복사하는 기능은 없습니다. 신청 기록은 지급 누락·중복 방지와 이용자 요청 처리를 위해 보관하며 고정 자동 만료는 없습니다. 삭제·정정 요청 시 데이터베이스 기록뿐 아니라 Discord 티켓 및 검토 메시지의 삭제 가능 범위도 함께 확인합니다. 계정·지급 이력의 변경은 중복 지급 방지 기록과 대조해 처리합니다.

The VVIP feature links Discord and YouTube channel IDs to an MLBB account/Zone ID and stores requested items, quoted diamond prices, verified membership periods, a member-supplied and confirmed expected renewal date when available, and staff verification/delivery records. Only a hash of the payment reference is stored for duplicate prevention; passwords and card details are not requested. The feature does not automatically retrieve exact billing dates or grant another claim solely because an expected date arrives.

It also stores ticket channel IDs, role/channel settings, discretionary extra-delivery records and reasons, processing staff IDs, and welcome-message deletion jobs. Ticket and review visibility follows applicant, configured staff, administrator and bot permissions. Ticket messages and submitted evidence remain on Discord; the feature does not copy ordinary ticket message bodies or original payment evidence into MongoDB. Records are retained for fulfillment, duplicate prevention and user requests, with no fixed automatic expiry. Access/correction/deletion requests can be sent to @gosugeneral or relayed through server moderators. Requests cover applicable database and Discord ticket/review records and are reconciled with duplicate-prevention history. Infrastructure backup limitations described above still apply.


## 출석 포인트·프로필 상점 / Community points and profile shop

출석·상점 기능은 서버 및 Discord 사용자 ID, 포인트 잔액·누적 적립 및 사용 합계, 마지막 출석 날짜와 시각(서부시간 기준), 출석 횟수·연속 출석, 보유한 꾸미기 상품과 장착 상태, 최근 구매 상품·가격·시각, 신청 패널의 채널·메시지 ID를 MongoDB에 저장합니다. 서버 회원은 /profile로 다른 회원의 포인트 잔액·출석 횟수·꾸미기 상태 및 기존 레벨·XP를 조회할 수 있습니다. 포인트는 출석·연속 출석 및 /share 미디어 기여 보상으로 적립하고 봇 프로필 꾸미기에 사용하며, 양도·현금화·스킨 교환을 지원하지 않습니다. 보관에 고정 자동 만료는 없으며 Discord @gosugeneral에게 확인·정정·삭제를 요청할 수 있습니다. 관련 기록 삭제 시 잔액·출석·보유 상품이 사라지고 다시 사용하면 빈 기록이 생성됩니다. 앞서 설명한 제공자 및 백업의 제한은 동일하게 적용됩니다.

The attendance/shop feature stores server and Discord user IDs, point balance and lifetime earned/spent totals, last check-in date/time (Pacific calendar day), visit count and streak, owned and equipped cosmetic items, most recent purchase item/price/time, and panel channel/message IDs in MongoDB. Server members can use /profile to view another member's balance, check-in count, selected cosmetics and existing XP/level. Points are earned through check-ins, streak bonuses and /share media contributions and spent on bot-profile cosmetics; transfers, cash redemption and skin exchanges are not supported. There is no fixed automatic expiry. Contact Discord @gosugeneral for access, correction or deletion. Deleting these records removes the balance, attendance and owned cosmetics; later use creates an empty wallet. The provider and backup limitations above still apply.


## 카드 이미지 및 완료 티켓 보관 / Card images and completed-ticket archives

레벨·랭킹·프로필 카드는 사용자 이름·아바타·기존 XP와 레벨·순위·포인트 및 선택한 꾸미기를 봇 서버에서 이미지로 생성해 Discord에 게시합니다. 별도 외부 이미지 생성 서비스로 전송하지 않습니다.

운영자가 실제 지급을 확인하면 8시간 이후, 봇은 티켓 대화·임베드 내용·작성자 ID·작성 시각을 HTML 파일로 만들고 첨부파일을 복사해 기존 비공개 스킨 검토 채널에 저장합니다. 저장과 접근 권한 확인에 실패하면 원본 티켓은 삭제하지 않습니다. 저장된 사본은 원본 채널 삭제 후에도 남고, 원본 삭제만으로 사본이 삭제되지는 않습니다. 신청 및 지급 기록과 누적 신청·지급 횟수는 MongoDB에 남으며, 대화 원문과 첨부 원본은 MongoDB에 저장하지 않습니다. 기존 접근·보관·삭제 요청 및 제공자 백업 제한이 사본에도 적용됩니다. 삭제 요청 시 보관 파일과 복사한 첨부파일을 함께 지정할 수 있습니다.

Level, leaderboard and profile cards are rendered on the bot server using usernames, avatars, existing XP/levels, rank, points and selected cosmetics, then posted to Discord. No separate third-party image-generation service receives this data.

Eight hours after the operator confirms actual delivery, the bot exports ticket messages, embeds, author IDs and timestamps into an HTML transcript and copies attachments to the existing private skin-review channel. It retains the source ticket if archiving or privacy verification fails. Archive copies remain after source-channel deletion and are not removed merely by deleting the source. MongoDB retains request/delivery records, cumulative counts and archive references, but not transcript bodies or original attachment bytes. The existing access, retention, deletion-request and provider-backup limitations apply to these copies. A deletion request may include archived transcripts and copied attachments.


## 2026-11-02 업데이트 / November 2, 2026 update

/share 명령으로 제출한 사진·영상은 사용자가 명령을 실행한 허용된 메인 채팅에 공개 게시됩니다. 보상은 비공개로 확인하며, 사진·영상 파일 자체는 중복 확인을 위해 봇 서버 메모리에서 일시적으로 읽고 SHA-256 해시를 계산합니다. MongoDB에는 파일 해시, 마지막 보상 날짜·종류와 포인트 기록을 저장하며 원본 파일은 저장하지 않습니다. 같은 파일 및 같은 서부시간 날짜의 중복 보상을 막는 용도입니다. Discord에 게시된 사본에는 Discord 및 해당 채널의 접근 권한과 보관 규칙이 적용됩니다. 일반 채팅 업로드는 현재 자동 보상하지 않습니다.

어디서나 /shop을 실행하면 비공개 이동 안내를 반환할 수 있으며, 상점 채널에서 실행자만 멘션하는 안내 메시지가 잠시 게시될 수 있습니다. 해당 메시지 ID·채널 ID와 약 30초 후 삭제 예정 시각을 저장하고 삭제 실패나 재시작 시 재시도합니다. 알림 멘션은 다른 회원에게도 상점 채널에서 잠시 보일 수 있지만 잔액과 구매 내역은 비공개입니다.

VVIP 티켓은 신청자·운영자·설정된 모더레이터·봇이 접근하며 서버 관리자 권한은 Discord 특성상 별도로 적용됩니다. 티켓을 만들 때 운영자와 신청자에게만 멘션 알림을 보내고 모더레이터 역할은 멘션하지 않습니다. 지급 완료 8시간 후 대화 저장과 접근 권한 확인을 거쳐 채널을 삭제하며, 메시지 내용을 읽거나 보관을 검증할 수 없으면 삭제하지 않고 원본을 유지합니다. 데이터 확인·정정·삭제는 Discord @gosugeneral에게 요청할 수 있습니다.

Photos/videos submitted with /share are published in the permitted main chat where the member invokes the command. Reward confirmations are private. The bot temporarily reads the submitted file in host memory and computes a SHA-256 hash; MongoDB stores that hash, the last rewarded Pacific date/type and point records, not original file bytes. These prevent rewards for repeated files or multiple contributions on the same Pacific day. Published Discord copies follow Discord's and the channel's access/retention rules. Ordinary chat uploads are not currently rewarded automatically.

Invoking /shop anywhere may return a private navigation link and briefly post a shop-channel notice mentioning only the invoker. Message/channel IDs and an approximately 30-second deletion deadline are stored for deletion and restart recovery. That temporary mention may be visible to other shop-channel members; balances and purchase details remain private.

VVIP tickets are accessible to the applicant, operator, configured moderators and bot, subject also to Discord administrator access. Creation pings only the operator and applicant, not the moderator role. Eight hours after delivery confirmation, the channel is deleted only after transcript storage and access verification; if message content cannot be read or archival cannot be confirmed, the original ticket is retained. Contact Discord @gosugeneral for access, correction or deletion requests.
