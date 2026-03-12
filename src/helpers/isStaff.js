// --- BOTÃO: CHAMAR STAFF ---
if (interaction.isButton() && cid === "call_staff") {
    const isDev = config.DEV_IDS.includes(user.id);
    const last = staffCooldown.get(user.id);

    // Verificação de tempo (cooldown)
    if (!isDev && last && (Date.now() - last < STAFF_WAIT)) {
        const falta = Math.ceil((STAFF_WAIT - (Date.now() - last)) / 1000);
        return interaction.reply({ 
            content: `⏳ Como não és developer, tens de esperar **${falta} segundos** para chamar de novo.`, 
            flags: [MessageFlags.Ephemeral] 
        });
    }

    // BUSCAR E ORDENAR: Cargo mais alto primeiro > Ordem Alfabética
    const members = await guild.members.fetch({ withPresences: true });
    
    const staffList = members
        .filter(m => isStaff(m) && !m.user.bot)
        .sort((a, b) => {
            // 1. Comparar posição do cargo (maior posição = mais alto na lista do Discord)
            const roleDiff = b.roles.highest.position - a.roles.highest.position;
            if (roleDiff !== 0) return roleDiff;

            // 2. Se tiverem o mesmo cargo, ordenar por Nome de A a Z
            return a.displayName.localeCompare(b.displayName);
        });

    if (staffList.size === 0) {
        return interaction.reply({ content: "❌ Ninguém da staff online.", flags: [MessageFlags.Ephemeral] });
    }

    // Criar as opções para o menu (máximo 25)
    const options = staffList.map(m => ({
        label: m.displayName,
        value: m.id,
        description: `Cargo: ${m.roles.highest.name}`
    })).slice(0, 25);

    const menu = new StringSelectMenuBuilder()
        .setCustomId("select_staff")
        .setPlaceholder("Escolhe o Staff (Ordenado por Cargo)")
        .addOptions(options);
    
    if (!isDev) staffCooldown.set(user.id, Date.now());

    const contentMsg = isDev 
        ? "⭐ **Modo Developer:** Podes chamar quem quiseres!" 
        : "Selecione o staff que deseja notificar:";

    return interaction.reply({ 
        content: contentMsg, 
        components: [new ActionRowBuilder().addComponents(menu)], 
        flags: [MessageFlags.Ephemeral] 
    });
}
