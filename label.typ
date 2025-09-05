#let generate(
  name: "<name>",
  school: "<school>",
  group: "<group>",
  id: "<id>",
) = {
  import "@preview/codetastic:0.2.2": qrcode

  set page(
    height: 40mm,
    width: 60mm,
    margin: 4mm,
  )
  set text(
    font: "HarmonyOS Sans SC",
    weight: 400,
    size: 4.2mm,
  )
  set block(
    spacing: 2mm,
  )

  block(spacing: 0mm, text(weight: 600, size: 8.2mm, font: "Alimama FangYuanTi VF", name))
  block(above: 3.4mm, below: 3.2mm, text(school))
  stack(
    spacing: 2mm,
    block(text(size: 2.8mm, weight: 300, [队伍])),
    block(width: 8em, breakable: false, group),
  )
  place(right + bottom, qrcode(id, width: 16mm, quiet-zone: 0))
}

#if "data" in sys.inputs {
  let data = json.decode(sys.inputs.data)
  generate(name: data.name, school: data.school, group: data.group, id: data.id)
} else {
  let data = (
    id: "vewqhz51lk",
    name: "梨汤可可",
    school: "西安电子科技大学",
    group: "爱可可组",
  )
  generate(name: data.name, school: data.school, group: data.group, id: data.id)
}
