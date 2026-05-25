require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TICKET_TYPES = [
  { label: 'Support', value: 'support' },
  { label: 'Report', value: 'report' },
  { label: 'Unban Request', value: 'unban-request' },
  { label: 'Tebex', value: 'tebex' },
  { label: 'Bug Report', value: 'bug-report' },
  { label: 'Warning Support', value: 'warning-support' }
];

function cleanName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 20);
}

client.once('ready', async () => {
  console.log(`${client.user.tag} is online`);

  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) return console.log('GUILD_ID is wrong or bot is not in the server.');

  const panelChannel = guild.channels.cache.get(process.env.TICKET_CHANNEL_ID);
  if (!panelChannel) return console.log('TICKET_CHANNEL_ID is wrong.');

  const logo = new AttachmentBuilder('./logo.png');

  const embed = new EmbedBuilder()
    .setTitle('TTK RZ TICKETS 2.0')
    .setDescription('Click the menu below and choose what ticket you need.')
    .setColor('#b000ff')
    .setImage('attachment://logo.png');

  const menu = new StringSelectMenuBuilder()
    .setCustomId('open_ticket')
    .setPlaceholder('🟣 Open Ticket')
    .addOptions(TICKET_TYPES.map(t => ({
      label: t.label,
      value: t.value,
      description: `Open a ${t.label} ticket`
    })));

  await panelChannel.send({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(menu)],
    files: [logo]
  });
});

client.on('interactionCreate', async interaction => {
  if (interaction.isStringSelectMenu() && interaction.customId === 'open_ticket') {
    const ticketValue = interaction.values[0];
    const ticketLabel = TICKET_TYPES.find(t => t.value === ticketValue)?.label || 'Support';

    const guild = interaction.guild;
    const staffRoleId = process.env.STAFF_ROLE_ID;
    const categoryId = process.env.TICKET_CATEGORY_ID || null;

    const existing = guild.channels.cache.find(c =>
      c.topic === `ticket-owner:${interaction.user.id}` && c.name.includes(ticketValue)
    );

    if (existing) {
      return interaction.reply({ content: `You already have this ticket open: ${existing}`, ephemeral: true });
    }

    const ticketChannel = await guild.channels.create({
      name: `${cleanName(interaction.user.username)}-${ticketValue}-ticket`,
      type: ChannelType.GuildText,
      parent: categoryId,
      topic: `ticket-owner:${interaction.user.id}`,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        },
        {
          id: staffRoleId,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.ManageChannels
          ]
        }
      ]
    });

    const claimButton = new ButtonBuilder()
      .setCustomId(`claim_${ticketValue}`)
      .setLabel('Claim Ticket')
      .setStyle(ButtonStyle.Primary);

    const closeButton = new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger);

    const embed = new EmbedBuilder()
      .setTitle(`🟣 ${ticketLabel} Ticket`)
      .setDescription(`${interaction.user}, your ticket was created here.\n\nStaff can claim this ticket below.\nThis ticket may be closed if there is no answer within 30 minutes.`)
      .setColor('#b000ff')
      .setImage('attachment://logo.png');

    await ticketChannel.send({
      content: `${interaction.user} <@&${staffRoleId}>`,
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(claimButton, closeButton)],
      files: [new AttachmentBuilder('./logo.png')]
    });

    await interaction.reply({ content: `Ticket created: ${ticketChannel}`, ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId.startsWith('claim_')) {
    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (!interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.reply({ content: 'Only staff can claim tickets.', ephemeral: true });
    }

    const ticketType = interaction.customId.replace('claim_', '');
    await interaction.channel.setName(`${cleanName(interaction.user.username)}-${ticketType}-ticket`);
    await interaction.reply(`🟣 ${interaction.user} claimed this ticket.`);
  }

  if (interaction.isButton() && interaction.customId === 'close_ticket') {
    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (!interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.reply({ content: 'Only staff can close tickets.', ephemeral: true });
    }

    await interaction.reply('Closing ticket in 5 seconds...');
    setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
  }
});

client.login(process.env.TOKEN);
