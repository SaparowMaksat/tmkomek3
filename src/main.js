import tel from 'telegraf'
import mes from 'telegraf/filters'
import cd from 'telegraf/format'
import config from 'config'
import { ogg } from './ogg.js'
import { openAI } from './openai.js'
const { Telegraf, session } = tel
const { code } = cd
const { message } = mes

const INITIAL_SESSION = {
	messages: [],
}

const bot = new Telegraf(config.get('TELEGRAM_TOKEN'))

bot.use(session())

bot.command('new', async ctx => {
	ctx.session = INITIAL_SESSION
	await ctx.reply('Жду вашего голосового или текстового сообщения')
})
bot.command('start', async ctx => {
	ctx.session = INITIAL_SESSION
	await ctx.reply('Жду вашего голосового или текстового сообщения')
})

bot.on(message('voice'), async ctx => {
	ctx.session ?? INITIAL_SESSION
	try {
		await ctx.reply(code('Сообщение принял. Жду ответ от сервера...'))
		const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id)
		const userId = String(ctx.message.from.id)
		const oggPath = await ogg.create(link.href, userId)
		const mp3Path = await ogg.toMp3(oggPath, userId)

		const text = await openAI.transcription(mp3Path)
		await ctx.reply(code(`Ваш запрос: ${text}`))

		ctx.session.messages.push({ role: openAI.roles.USER, content: text })

		const response = await openAI.chat(ctx.session.messages)

		ctx.session.messages.push({
			role: openAI.roles.ASSISTANT,
			content: response.content,
		})

		await ctx.reply(response.content)
	} catch (error) {
		console.log(`Error while voice message`, error.message)
	}
})
bot.on(message('text'), async ctx => {
	ctx.session ?? INITIAL_SESSION
	try {
		await ctx.reply(code('Сообщение принял. Жду ответ от сервера...'))

		ctx.session.messages.push({
			role: openAI.roles.USER,
			content: ctx.message.text,
		})

		const response = await openAI.chat(ctx.session.messages)

		ctx.session.messages.push({
			role: openAI.roles.ASSISTANT,
			content: response.content,
		})

		await ctx.reply(response.content)
	} catch (error) {
		console.log(`Error while voice message`, error.message)
	}
})

bot.launch()

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
