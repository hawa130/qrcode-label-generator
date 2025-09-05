#let pad-left(str, length: 2) = {
  let padding = length - str.len()
  if (padding > 0) {
    let i = 0
    while (i < padding) {
      str = "0" + str
      i = i + 1
    }
  }
  str
}

#let generate(
  group: "<group>",
  name: "<name>",
  groupId: 1,
  assetId: 1,
) = {
  import "@preview/codetastic:0.2.2": ean8

  set page(
    height: 40mm,
    width: 60mm,
    margin: 4mm,
  )
  set text(
    font: "HarmonyOS Sans SC",
    weight: 400,
    size: 4.8mm,
  )
  set block(
    spacing: 5mm,
  )

  block(spacing: 0mm, text(weight: 600, size: 8.2mm, font: "Alimama FangYuanTi VF", name))
  stack(
    spacing: 3mm,
    block(text(size: 3.5mm, weight: 300, [所属队伍])),
    block(width: 6em, breakable: false, group),
  )
  place(right + top, text(size: 6mm, pad-left(str(groupId), length: 2)))
  place(right + bottom, ean8(groupId * 1000 + assetId))
}

#let data = (
  group: "师兄会帮我调代码对不队",
  name: "USB网卡",
  groupId: 2,
  assetId: 1,
)
#generate(group: data.group, name: data.name, groupId: data.groupId, assetId: data.assetId)
