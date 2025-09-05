import { $ } from 'bun'
import lark from '@larksuiteoapi/node-sdk'

const appToken = 'JUdbb9kTBaZBXqsDciMcbwYBn8g'
const tableId = 'tblFWDcFZgLQIePl'

type QueryCondition = { id?: string; name?: string; phone?: string }

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

  if (!process.env.APP_ID || !process.env.APP_SECRET) {
    throw new Error('APP_ID and APP_SECRET must be set in environment variables')
  }

  const client = new lark.Client({
    appId: process.env.APP_ID,
    appSecret: process.env.APP_SECRET,
    disableTokenCache: false,
    loggerLevel: lark.LoggerLevel.error,
  })

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
  const recordId = res.data?.items?.[0]!.record_id

  const groupData = rawData['队伍名'] as { type: number; value: { text: string }[] } | undefined
  if (!groupData) {
    throw new Error('选手未组队')
  }

  return {
    id: recordId,
    name: (rawData['姓名'] as { text: string }[])[0]!.text,
    school: (rawData['学校'] as { text: string }[])[0]!.text,
    group: groupData.value[0]!.text,
  }
}

async function generateLabel(query: QueryCondition) {
  const data = await fetchStudentData(query).catch((e) => {
    console.error(e.message)
    throw e
  })
  await $`typst compile label.typ label.pdf --input data=${JSON.stringify(data)}`
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
          'Content-Disposition': 'attachment; filename="label.pdf"',
        },
      })
    },
  },
})
