import { join } from 'node:path'
import { $ } from 'bun'
import lark from '@larksuiteoapi/node-sdk'
import { console } from 'node:inspector'

const appToken = 'JUdbb9kTBaZBXqsDciMcbwYBn8g'
const tableId = 'tblFWDcFZgLQIePl'

type QueryCondition = { id?: string; name?: string; phone?: string }

function createClient() {
  if (!process.env.APP_ID || !process.env.APP_SECRET) {
    throw new Error('APP_ID and APP_SECRET must be set in environment variables')
  }

  const client = new lark.Client({
    appId: process.env.APP_ID,
    appSecret: process.env.APP_SECRET,
    disableTokenCache: false,
    loggerLevel: lark.LoggerLevel.error,
  })

  return client
}

async function fetchStudentData({ id, name, phone }: QueryCondition) {
  const conditions: {
    field_name: string
    operator:
      | 'is'
      | 'isNot'
      | 'contains'
      | 'doesNotContain'
      | 'isEmpty'
      | 'isNotEmpty'
      | 'isGreater'
      | 'isGreaterEqual'
      | 'isLess'
      | 'isLessEqual'
      | 'like'
      | 'in'
    value?: string[]
  }[] = []

  if (id) conditions.push({ field_name: '记录 ID', operator: 'is', value: [id] })
  if (name) conditions.push({ field_name: '姓名', operator: 'is', value: [name] })
  if (phone) conditions.push({ field_name: '电话', operator: 'is', value: [phone] })
  if (conditions.length === 0) throw new Error('查询参数必须提供 id、name 或 phone 中的一个')

  const client = createClient()

  const res = await client.bitable.v1.appTableRecord
    .search({
      path: {
        app_token: appToken,
        table_id: tableId,
      },
      params: {
        page_size: 5,
      },
      data: {
        filter: {
          conjunction: 'or',
          conditions,
        },
      },
    })
    .catch((e) => {
      console.error(JSON.stringify(e.response.data, null, 4))
      throw new Error('查询选手数据失败')
    })

  const rawData = res.data?.items?.[0]?.fields
  if (!rawData) {
    throw new Error('未找到选手信息')
  }
  const recordId = res.data?.items?.[0]!.record_id as string

  const groupData = rawData['队伍名'] as { type: number; value: { text: string }[] } | undefined
  if (!groupData) {
    throw new Error('选手未组队')
  }

  const hasSignedIn = Boolean(rawData['签到时间'])

  return {
    recordId,
    id: `https://h.115.zone/?id=${recordId}`,
    name: (rawData['姓名'] as { text: string }[])[0]!.text,
    school: (rawData['学校'] as { text: string }[])[0]!.text,
    group: groupData.value[0]!.text,
    hasSignedIn,
  }
}

async function signin(id: string) {
  const client = createClient()

  await client.bitable.v1.appTableRecord
    .update({
      path: {
        app_token: appToken,
        table_id: tableId,
        record_id: id,
      },
      data: {
        fields: { 签到时间: Date.now() },
      },
    })
    .catch((e) => {
      console.error(JSON.stringify(e.response.data, null, 4))
      throw new Error('更新签到时间失败，请手动更新')
    })
}

async function generateLabel(query: QueryCondition) {
  console.log('正在查询选手数据', query.id ? `id: ${query.id}` : ``)
  const data = await fetchStudentData(query).catch((e) => {
    console.error(e.message)
    throw e
  })
  console.log(
    '查询到选手数据',
    `姓名：${data.name}`,
    `学校：${data.school}`,
    `队伍：${data.group}`,
    data.hasSignedIn ? '已签到' : '未签到',
  )

  const pdfFilePath = join('./outputs', `${data.recordId}.pdf`)
  const generateAndPrint = async () => {
    await $`typst compile label.typ ${pdfFilePath} --font-path fonts --input data=${JSON.stringify(data)}`
    console.log('已生成选手标签', pdfFilePath)
    if (process.platform === 'win32') {
      await $`SumatraPDF.exe -print-to GE350 -print-settings landscape ${pdfFilePath}`
      console.log('选手标签打印任务已发送至标签打印机')
    }
  }

  if (data.hasSignedIn) {
    await generateAndPrint()
  } else {
    await Promise.all([generateAndPrint(), signin(data.recordId)])
  }
  console.log('============================')
}

Bun.serve({
  routes: {
    '/generate-label': async (req) => {
      const url = new URL(req.url)
      const id = url.searchParams.get('id') || undefined
      const name = url.searchParams.get('name') || undefined
      const phone = url.searchParams.get('phone') || undefined

      if (!id && !name && !phone) {
        return new Response('查询参数必须提供 id、name 或 phone 中的一个', { status: 400 })
      }

      await generateLabel({ id, name, phone })

      const pdf = await Bun.file('label.pdf').arrayBuffer()
      return new Response(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
        },
      })
    },
    '/trigger-generate-label': async (req) => {
      const url = new URL(req.url)
      const id = url.searchParams.get('id') || undefined
      const name = url.searchParams.get('name') || undefined
      const phone = url.searchParams.get('phone') || undefined

      if (!id && !name && !phone) {
        return new Response('查询参数必须提供 id、name 或 phone 中的一个', { status: 400 })
      }

      generateLabel({ id, name, phone })

      return new Response('ok', { status: 200 })
    },
  },
})
