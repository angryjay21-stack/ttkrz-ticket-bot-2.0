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

const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const TICKET_CHANNEL_ID = process.env.TICKET_CHANNEL_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;

const PURPLE = 0xb000ff;

const TICKET_TYPES = [
  { label: 'Support', value: 'support' },
  { label: 'Report', value: 'report' },
  { label: 'Unban Request', value: 'unban-request' },
  { label: 'Tebex', value: 'tebex' },
  { label: 'Bug Report', value: 'bug-report' },
  { label: 'Warning Support', value: 'warning-support' }
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

function cleanName(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'user';
}

function getTicketLabel(value) {
  return TICKET_TYPES.find(t => t.value === value)?.label || 'Support';
}

async function sendPanel() {
  const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
  if (!guild) {
    console.log('ERROR: GUILD_ID is wrong, or the bot is not inside that server.');
    return;
  }

  const panelChannel = await guild.channels.fetch(TICKET_CHANNEL_ID).catch(() => null);
  if (!panelChannel || panelChannel.type !== ChannelType.GuildText) {
    console.log('ERROR: TICKET_CHANNEL_ID is wrong, or it is not a text channel.');
    return;
  }

  const me = await guild.members.fetchMe();
  const perms = panelChannel.permissionsFor(me);
  if (!perms.has(PermissionsBitField.Flags.SendMessages) || !perms.has(PermissionsBitField.Flags.EmbedLinks)) {
    console.log('ERROR: Bot needs Send Messages and Embed Links in the ticket panel channel.');
    return;
  }

  const oldPanels = await panelChannel.messages.fetch({ limit: 20 }).catch(() => null);
  const alreadyPosted = oldPanels?.some(msg =>
    msg.author.id === client.user.id &&
    msg.embeds?.[0]?.title === 'TTK RZ TICKETS 2.0'
  );

  if (alreadyPosted) {
    console.log('Ticket panel already exists. Not posting another one.');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('TTK RZ TICKETS 2.0')
    .setDescription('Press the menu below and choose what ticket you want to open.')
    .setColor(PURPLE)
    .setImage('attachment://logo.png')
    .setFooter({ text: 'Neon purple and black ticket system' });

  const menu = new StringSelectMenuBuilder()
    .setCustomId('ttkrz_open_ticket')
    .setPlaceholder('🟣 Open Ticket')
    .addOptions(TICKET_TYPES.map(t => ({
      label: t.label,
      value: t.value,
      description: `Open a ${t.label} ticket`
    })));

  await panelChannel.send({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(menu)],
    files: [new AttachmentBuilder('./logo.png')]
  });

  console.log('Ticket panel posted.');
}

client.once('ready', async () => {
  console.log(`${client.user.tag} is online.`);
  console.log('Starting TTK RZ Tickets 2.0...');
  await sendPanel();
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isStringSelectMenu() && interaction.customId === 'ttkrz_open_ticket') {
      await interaction.deferReply({ ephemeral: true });

      const guild = interaction.guild;
      const ticketValue = interaction.values[0];
      const ticketLabel = getTicketLabel(ticketValue);
      const userName = cleanName(interaction.user.username);

      const staffRole = await guild.roles.fetch(STAFF_ROLE_ID).catch(() => null);
      if (!staffRole) {
        return interaction.editReply('Bot setup error: STAFF_ROLE_ID is wrong.');
      }

      let parent = null;
      if (TICKET_CATEGORY_ID && TICKET_CATEGORY_ID !== 'OPTIONAL_CATEGORY_ID_HERE') {
        parent = await guild.channels.fetch(TICKET_CATEGORY_ID).catch(() => null);
        if (!parent || parent.type !== ChannelType.GuildCategory) {
          return interaction.editReply('Bot setup error: TICKET_CATEGORY_ID is wrong or is not a category.');
        }
      }

      const existing = guild.channels.cache.find(ch =>
        ch.type === ChannelType.GuildText &&
        ch.topic === `ttkrz-ticket-owner-${interaction.user.id}` &&
        ch.name.includes(ticketValue)
      );

      if (existing) {
        return interaction.editReply(`You already have this ticket open: ${existing}`);
      }

      const me = await guild.members.fetchMe();
      const botPerms = parent ? parent.permissionsFor(me) : guild.members.me.permissions;
      if (!botPerms.has(PermissionsBitField.Flags.ManageChannels)) {
        return interaction.editReply('Bot setup error: I need Manage Channels permission.');
      }

      const ticketChannel = await guild.channels.create({
        name: `${userName}-${ticketValue}-ticket`,
        type: ChannelType.GuildText,
        parent: parent ? parent.id : null,
        topic: `ttkrz-ticket-owner-${interaction.user.id}`,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [
              PermissionsBitField.Flags.ViewChannel
            ]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AttachFiles,
              PermissionsBitField.Flags.EmbedLinks
            ]
          },
          {
            id: STAFF_ROLE_ID,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AttachFiles,
              PermissionsBitField.Flags.EmbedLinks,
              PermissionsBitField.Flags.ManageChannels
            ]
          },
          {
            id: client.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AttachFiles,
              PermissionsBitField.Flags.EmbedLinks,
              PermissionsBitField.Flags.ManageChannels
            ]
          }
        ],
        reason: `TTK RZ ticket opened by ${interaction.user.tag}`
      });

      const embed = new EmbedBuilder()
        .setTitle(`🟣 ${ticketLabel} Ticket`)
        .setDescription(
          `${interaction.user}, your ticket has been created.\n\n` +
          `Staff will help you here.\n\n` +
          `A staff member can press **Claim Ticket**.\n` +
          `This ticket can be closed if there is no answer within **30 minutes**.`
        )
        .setColor(PURPLE)
        .setImage('attachment://logo.png');

      const claimButton = new ButtonBuilder()
        .setCustomId(`ttkrz_claim_${ticketValue}`)
        .setLabel('Claim Ticket')
        .setStyle(ButtonStyle.Primary);

      const closeButton = new ButtonBuilder()
        .setCustomId('ttkrz_close_ticket')
        .setLabel('Close Ticket')
        .setStyle(ButtonStyle.Danger);

      await ticketChannel.send({
        content: `${interaction.user} <@&${STAFF_ROLE_ID}>`,
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(claimButton, closeButton)],
        files: [new AttachmentBuilder('./logo.png')]
      });

      await interaction.editReply(`Ticket created: ${ticketChannel}`);
      console.log(`Ticket created: ${ticketChannel.name}`);
    }

    if (interaction.isButton() && interaction.customId.startsWith('ttkrz_claim_')) {
      const member = interaction.member;
      if (!member.roles.cache.has(STAFF_ROLE_ID)) {
        return interaction.reply({ content: 'Only staff can claim tickets.', ephemeral: true });
      }

      const ticketValue = interaction.customId.replace('ttkrz_claim_', '');
      const staffName = cleanName(interaction.user.username);
      await interaction.channel.setName(`${staffName}-${ticketValue}-ticket`);
      await interaction.reply(`🟣 ${interaction.user} claimed this ticket.`);
    }

    if (interaction.isButton() && interaction.customId === 'ttkrz_close_ticket') {
      const member = interaction.member;
      if (!member.roles.cache.has(STAFF_ROLE_ID)) {
        return interaction.reply({ content: 'Only staff can close tickets.', ephemeral: true });
      }

      await interaction.reply('Closing ticket in 5 seconds...');
      setTimeout(() => {
        interaction.channel.delete('Ticket closed').catch(console.error);
      }, 5000);
    }
  } catch (error) {
    console.error('INTERACTION ERROR:', error);
    if (interaction.deferred || interaction.replied) {
      interaction.editReply('Something went wrong creating the ticket. Check Railway logs.').catch(() => {});
    } else {
      interaction.reply({ content: 'Something went wrong creating the ticket. Check Railway logs.', ephemeral: true }).catch(() => {});
    }
  }
});

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

if (!TOKEN || !GUILD_ID || !TICKET_CHANNEL_ID || !STAFF_ROLE_ID) {
  console.log('ERROR: Missing variables. You need TOKEN, GUILD_ID, TICKET_CHANNEL_ID, STAFF_ROLE_ID.');
  process.exit(1);
}

client.login(TOKEN);
