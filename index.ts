import { join } from 'node:path'
import { $ } from 'bun'
import lark from '@larksuiteoapi/node-sdk'
import { console } from 'node:inspector'

const studentAppToken = 'JUdbb9kTBaZBXqsDciMcbwYBn8g'
const studentTableId = 'tblFWDcFZgLQIePl'

const groupAppToken = 'JUdbb9kTBaZBXqsDciMcbwYBn8g'
const groupTableId = 'tblTXy6S916Yt7IE'

type StudentQueryCondition = { id?: string; name?: string; phone?: string }

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

type QueryCondition = {
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
}

type StudentData = {
  recordId: string
  id: string
  name: string
  school: string
  group: string
  groupId: number
  hasCheckedIn: boolean
}

async function fetchStudentData({ id, name, phone }: StudentQueryCondition): Promise<StudentData> {
  const conditions: QueryCondition[] = []

  if (id) conditions.push({ field_name: '记录 ID', operator: 'is', value: [id] })
  if (name) conditions.push({ field_name: '姓名', operator: 'is', value: [name] })
  if (phone) conditions.push({ field_name: '电话', operator: 'is', value: [phone] })
  if (conditions.length === 0) throw new Error('查询参数必须提供 id、name 或 phone 中的一个')

  const client = createClient()

  const res = await client.bitable.v1.appTableRecord
    .search({
      path: {
        app_token: studentAppToken,
        table_id: studentTableId,
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

  const groupId = (rawData['队伍编号'] as { type: number; value: number[] }).value[0] as number
  const hasCheckedIn = Boolean(rawData['签到时间'])

  return {
    recordId,
    id: `https://h.115.zone/?id=${recordId}`,
    name: (rawData['姓名'] as { text: string }[])[0]!.text,
    school: (rawData['学校'] as { text: string }[])[0]!.text,
    group: groupData.value[0]!.text,
    groupId,
    hasCheckedIn,
  }
}

async function studentCheckIn(id: string) {
  const client = createClient()
  console.log('正在为选手签到')
  await client.bitable.v1.appTableRecord
    .update({
      path: {
        app_token: studentAppToken,
        table_id: studentTableId,
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
  console.log('选手签到成功')
}

async function hasGroupCheckedIn(groupId: number) {
  const client = createClient()

  const res = await client.bitable.v1.appTableRecord
    .search({
      path: {
        app_token: groupAppToken,
        table_id: groupTableId,
      },
      params: {
        page_size: 5,
      },
      data: {
        field_names: ['签到时间'],
        filter: {
          conjunction: 'or',
          conditions: [{ field_name: '队伍编号', operator: 'is', value: [String(groupId)] }],
        },
      },
    })
    .catch((e) => {
      console.error(JSON.stringify(e.response.data, null, 4))
      throw new Error(`查询队伍签到信息失败 id: ${groupId}`)
    })

  const rawData = res.data?.items?.[0]?.fields
  if (!rawData) {
    throw new Error(`未找到队伍信息 id: ${groupId}`)
  }

  return {
    hasCheckedIn: Boolean(rawData['签到时间']),
    recordId: res.data?.items?.[0]!.record_id as string,
  }
}

async function groupCheckIn(recordId: string) {
  const client = createClient()
  console.log(`正在为队伍签到`)
  await client.bitable.v1.appTableRecord
    .update({
      path: {
        app_token: groupAppToken,
        table_id: groupTableId,
        record_id: recordId,
      },
      data: {
        fields: { 签到时间: Date.now() },
      },
    })
    .catch((e) => {
      console.error(JSON.stringify(e.response.data, null, 4))
      throw new Error('更新队伍签到时间失败，请手动更新')
    })
  console.log('队伍签到成功')
}

async function printAssetLabel(studentData: StudentData) {
  console.log(`检查队伍 ${studentData.group} 签到情况`)
  const { hasCheckedIn, recordId } = await hasGroupCheckedIn(studentData.groupId)
  if (hasCheckedIn) {
    console.log(`队伍 ${studentData.group} 已签到，跳过资产标签打印`)
    return
  }
  console.log(`队伍 ${studentData.group} 未签到`)
  const generateAndPrint = async () => {
    const assets = [
      {
        id: 1,
        name: '香橙派',
      },
      {
        id: 2,
        name: '电源适配器',
      },
      {
        id: 3,
        name: 'USB网卡',
      },
    ]
    for (const asset of assets) {
      const pdfFilePath = join('./outputs', `${studentData.groupId}-${asset.id}.pdf`)
      await $`typst compile asset.typ ${pdfFilePath} --font-path fonts --input data=${JSON.stringify({
        group: studentData.group,
        name: asset.name,
        groupId: studentData.groupId,
        assetId: asset.id,
      })}`
      console.log('已生成资产标签，正在发送打印任务', pdfFilePath)
    }
  }
  await Promise.all([generateAndPrint(), groupCheckIn(recordId)])
  console.log('============================')
}

async function generateLabel(query: StudentQueryCondition) {
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
    data.hasCheckedIn ? '已签到' : '未签到',
  )

  const pdfFilePath = join('./outputs', `${data.recordId}.pdf`)
  const generateAndPrint = async () => {
    await $`typst compile label.typ ${pdfFilePath} --font-path fonts --input data=${JSON.stringify(data)}`
    console.log('已生成选手标签，正在发送打印任务', pdfFilePath)
    if (process.platform === 'win32') {
      await $`SumatraPDF.exe -print-to GE350 -print-settings landscape ${pdfFilePath}`
      console.log('选手标签打印完成')
    }
  }

  if (!data.hasCheckedIn) {
    await Promise.all([generateAndPrint(), studentCheckIn(data.recordId), printAssetLabel(data)])
  } else {
    await generateAndPrint()
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
