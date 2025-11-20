// =====================================================
// BUTTON INTERACTIONS (수정된 Live Notification Panel 로직)
// =====================================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const { customId, guild, member } = interaction;
  
  // ... (Agree to Rules 로직 생략) ...

  // -------- Subscribe / Unsubscribe Toggle Button (단일 역할 토글 로직으로 변경) --------
  if (customId === "sub_subscribe") {
    // 구독 역할 ID만 사용합니다.
    const subRole = guild.roles.cache.get(SUB_ROLE);

    if (!subRole) {
      return interaction.reply({
        content: "⚠ Live Notification 역할 ID가 올바르게 설정되지 않았습니다. 관리자에게 문의하세요.",
        ephemeral: true,
      });
    }

    try {
      // 1. 현재 멤버가 구독 역할을 가지고 있는지 확인
      if (member.roles.cache.has(SUB_ROLE)) {
        // 2. 역할 제거 (Unsubscribe)
        await member.roles.remove(subRole);
        return interaction.reply({
          content: `🔕 실시간 알림 역할 (**${subRole.name}**)이 **제거**되었습니다.`,
          ephemeral: true,
        });
      } else {
        // 3. 역할 부여 (Subscribe)
        await member.roles.add(subRole);

        return interaction.reply({
          content: `✅ 실시간 알림 역할 (**${subRole.name}**)이 **부여**되었습니다.`,
          ephemeral: true,
        });
      }
    } catch (err) {
      console.error("Subscribe toggle error:", err);
      return interaction.reply({
        content: "⚠ 역할을 업데이트하지 못했습니다. 봇의 권한을 확인하세요.",
        ephemeral: true,
      });
    }
  }
  
  // ... (Color buttons 로직 생략) ...
});
