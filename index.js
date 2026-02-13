const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

const usersMap = new Map();
const LIMIT = 5; 
const DIFF = 2000;

client.once('ready', () => {
    console.log(`✅ Bot prêt ! Connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // 1. DÉTECTION NSFW & SUPPRESSION (Mise à jour avec tes nouveaux mots)
    const nsfwWords = ['porn', 'nude', 'sex', 'nsfw', 'bite', 'cul', 'porno']; 
    
    // On vérifie si le message contient l'un des mots de la liste
    if (nsfwWords.some(word => message.content.toLowerCase().includes(word))) {
        try {
            // 1. On supprime le message d'abord
            await message.delete().catch(() => {}); 
            
            // 2. On bannit l'utilisateur
            await message.member.ban({ reason: 'Contenu NSFW interdit (Bite/Cul/etc.)' });
            
            // 3. On prévient dans le salon
            return message.channel.send(`🚨 **${message.author.tag}** a été banni définitivement pour avoir utilisé un mot interdit.`);
        } catch (e) { 
            console.log("Erreur lors du ban NSFW : Vérifie que mon rôle est bien au-dessus de l'utilisateur."); 
        }
    }

   // 2. ANTI-SPAM AMÉLIORÉ
    if (usersMap.has(message.author.id)) {
        const userData = usersMap.get(message.author.id);
        const difference = message.createdTimestamp - userData.lastMessage.createdTimestamp;
        let msgCount = userData.msgCount;

        // Si l'utilisateur est déjà en "Timeout", on supprime direct ses messages
        if (message.member.communicationDisabledUntilTimestamp > Date.now()) {
            return message.delete().catch(() => {}); 
        }

        if (difference < DIFF) {
            msgCount++;
            if (msgCount >= LIMIT) {
                try {
                    // Supprime les messages de spam récents
                    const messages = await message.channel.messages.fetch({ limit: 20 });
                    const userMessages = messages.filter(m => m.author.id === message.author.id);
                    await message.channel.bulkDelete(userMessages).catch(() => {});

                    // Applique le Timeout (Mute)
                    await message.member.timeout(300000, 'Spam intensif');
                    message.channel.send(`🚫 **${message.author.tag}** a été mute 5 min. Ses prochains messages seront supprimés automatiquement.`);
                } catch (e) { 
                    console.log("Erreur : Impossible de mute.");
                }
                usersMap.delete(message.author.id);
            } else {
                userData.msgCount = msgCount;
                userData.lastMessage = message;
                usersMap.set(message.author.id, userData);
            }
        } else {
            usersMap.set(message.author.id, { msgCount: 1, lastMessage: message });
        }
    } else {
        usersMap.set(message.author.id, { msgCount: 1, lastMessage: message });
    }

    // 3. ALERTE TICKET (Correction : On vérifie si le salon est nouveau ou actif)
    if (message.channel.name.toLowerCase().includes('ticket')) {
        // Pour éviter de spammer les owners à chaque message, on peut limiter l'alerte
        const rolesToNotify = [process.env.ROLE_SUPPORT, process.env.ROLE_OWNER];
        const guildMembers = await message.guild.members.fetch();
        
        guildMembers.forEach(member => {
            if (member.roles.cache.some(r => rolesToNotify.includes(r.id))) {
                member.send(`📩 **Alerte Ticket** : Nouveau message dans ${message.channel} par **${message.author.tag}**.`)
                .catch(() => {}); 
            }
        });
    }

    // 4. COMMANDE !UNMUTE
    if (message.content.startsWith('!unmute')) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply("Tu n.as pas la permission !");
        }
        const target = message.mentions.members.first();
        if (!target) return message.reply("Mentionne quelqu'un à unmute !");
        
        try {
            await target.timeout(null);
            message.channel.send(`✅ ${target.user.tag} n'est plus mute.`);
        } catch (e) { message.reply("Impossible d'unmute cette personne."); }
    }
});

client.login(process.env.TOKEN);