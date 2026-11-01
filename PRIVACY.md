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


봇은 Quaxly에서 실행되며, 지속 데이터는 운영자가 설정한 MongoDB 서비스에 저장합니다. Discord, 호스팅 및 데이터베이스 제공자는 서비스 제공에 필요한 범위에서 관련 데이터를 처리할 수 있습니다. 운영자는 봇 유지관리와 이용자 요청 처리에 필요한 범위에서 저장 데이터에 접근합니다. 각 제공자의 인프라와 설정에 따라 데이터가 이용자 거주 국가 외에서 처리될 수 있습니다.


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


The bot runs on Quaxly and persistent data is stored in the operator-configured MongoDB service. Discord and infrastructure providers may process data to provide their services. The operator accesses stored data as needed for maintenance and user requests. Depending on provider infrastructure and configuration, processing may take place outside a user's country.


XP and level records are retained while needed for the service and deleted on request or when no longer needed. Current code has no fixed automatic expiration or automatic deletion when a member leaves; deletion within 30 days is not guaranteed. Discord log copies and provider backups may persist separately. Available deletion scope and limitations will be explained when handling a request.


## Your requests


For access, correction, deletion or processing questions, DM Discord **@gosugeneral**. If DMs are unavailable, ask Gosu General TV moderators to relay the request to that account. Include your Discord user ID, relevant server and requested action. Never send passwords, bot tokens or login secrets. The operator reviews requests after proportionate identity verification and explains the outcome or any inability to fulfill them.


Deleting XP may affect levels and rankings. There is currently no automated per-user opt-out command. Continued activity in channels accessible to the bot may create new records after deletion, so specify if you also want future processing restricted. Server administrators can restrict channel access or remove the bot.


## Security and changes


Bot and database credentials are managed as secret settings rather than public source code, and data access is limited to operational needs. This policy does not certify unverified database encryption-at-rest settings or security certifications. The policy will be updated when processing changes, with material changes announced through suitable server notices. Contact: Discord **@gosugeneral**.
