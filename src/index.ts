import Koa from "koa"
import Static from "koa-static"
import Router from "koa-router"

import fs from "fs"
import path from "path"

import { getVoiceList } from "./lib/voice"
import { generateTTS } from "./lib/generator"
import { cleanVoices } from "./lib/clean"

const app = new Koa()
const router = new Router()
// 自定义中间件设置 CORS 响应头
app.use(async (ctx, next) => {
    ctx.set("Access-Control-Allow-Origin", "*"); // 允许所有域名
    ctx.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS"); // 允许的 HTTP 方法
    ctx.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept"); // 允许的请求头

    // 处理 OPTIONS 预检请求
    if (ctx.method === "OPTIONS") {
        ctx.status = 204; // 返回无内容状态码
        return;
    }

    await next();
})

app.use(Static("public"))

router.get("/", (ctx) => {
    if (process.env.NODE_ENV === "production") {
        ctx.body = fs.readFileSync(
            path.resolve("public", "index.html"),
            "utf-8"
        )
    } else {
        ctx.redirect("https://localhost:5173")
    }
})

// 获取声音列表
router.get("/voices", async (ctx) => {
    const { search } = ctx.query
    let voices = getVoiceList()
    if (!!search) {
        voices = voices.filter((voice) => {
            if (Array.isArray(search)) {
                return search.some((s) =>
                    voice.toLowerCase().includes(s.toLowerCase())
                )
            } else {
                return voice.toLowerCase().includes(search.toLowerCase())
            }
        })
    }

    ctx.body = {
        voices,
    }
})

// tts 接口
router.get("/tts", (ctx) => {
    // 返回 link
    const { text, voice } = ctx.query
    if (!text || !voice) {
        ctx.status = 500
        ctx.body = {
            error: "text and voice are required",
        }
        return
    }

    if (Array.isArray(text) || Array.isArray(voice)) {
        ctx.status = 500
        ctx.body = {
            error: "text and voice should not be array",
        }
        return
    }

    try {
        cleanVoices()
        const result = generateTTS(decodeURIComponent(text), voice)
        ctx.body = {
            url: result,
        }
    } catch (e: any) {
        ctx.status = 500
        ctx.body = {
            error: e.message,
        }
    }
})

// 清除现有文件
router.get("/clean", (ctx) => {
    const { secret } = ctx.query
    if (!secret) {
        ctx.status = 403
        ctx.body = {
            error: "secret is required",
        }
        return
    }

    if (!process.env.CLEAN_SECRET) {
        ctx.status = 500
        ctx.body = {
            error: "clean_secret is not set",
        }
        return
    }

    if (secret !== process.env.CLEAN_SECRET) {
        ctx.status = 403
        ctx.body = {
            error: "secret is invalid",
        }
        return
    }

    try {
        cleanVoices()
        ctx.body = "Cleaned"
    } catch (e) {
        ctx.status = 500
        ctx.body = {
            error: "Clean failed",
        }
    }
})

app.use(router.routes())

app.listen(8088, () => {
    console.log("Server is running on port 8080")
})
