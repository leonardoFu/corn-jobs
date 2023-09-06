import { Client } from "@notionhq/client"
import { DateTime } from 'luxon'

const notion = new Client({ auth: process.env.NOTION_API_KEY })


const databaseId = process.env.DAILY_CHECKOUT_DB_ID

function genNewTitle () {
  const date = DateTime.now().setZone("Asia/Shanghai");
  const dateString = date.toLocaleString({ ...DateTime.DATE_SHORT, year: undefined })
  console.log(dateString)
  return `${dateString} ${date.weekdayLong} Check`;
}

function genNewDate() {
  const date = new Date(); // 获取当前日期和时间

  // 使用中国时区（北京时间）和语言格式
  let dateString = date.toLocaleString("zh-CN", {timeZone: "Asia/Shanghai", hour12: false});

  // 使用箭头函数和模板字符串将日期格式化为 "yyyy-mm-dd" 的形式
  dateString = dateString.replace(/^(.*?)(\d+\/\d+\/\d+)(.*?)$/, (_, $1, $2) => {
      const parts = $2.split('/');
    return `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  });

  return dateString;
}

function genPropsFromOld(oldProps) {
  return Object.keys(oldProps).reduce((newProps, propName) => {
    const prop = oldProps[propName];

    newProps[propName] = prop;
    delete prop.id;
    switch (prop.type) {
      case 'checkbox':
        prop.checkbox = false;
        break;
      case 'date':
        prop.date.start = genNewDate();
        break;
      case 'relation':
        prop.relation = [];
        prop.has_more = false;
        break;
      case 'rich_text':
        prop.rich_text = [];
        break;
      case 'title':
        prop.title = [
          {
            "type": "text",
            "text": {
              "content": genNewTitle(),
              "link": null
            }
          }
        ]
        break;
    }
    return newProps;
  }, {})

}

async function createTodayCheck(oldPage) {
  try {
    let oldPageBlocks
    if (oldPage && oldPage.id) {
      oldPageBlocks = await notion.blocks.children.list({
        block_id: oldPage.id
      })
    }
    const properties = genPropsFromOld(oldPage.properties)
    console.log('--New Page Properties--');
    console.log(JSON.stringify(properties, 0, 2))
    await notion.pages.create({
      properties: properties,
      parent: {
        type: 'database_id',
        database_id: databaseId
      }
    })

  } catch (e) {
    console.error(e);
  }
}

(async function main() {
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
          "and": [
              {
                  "property": "Archive",
                  "checkbox": {
                      "equals": false
                  }
              }
          ]
      },
      sorts: [{
        "property": "Date",
        "direction": "descending"
      }]
    })
    if (response.results && response.results.length > 0) {
      const page = response.results.shift();
      // 寻找到页面
      const pageDetail = await notion.pages.retrieve({ page_id: page.id });
      console.log(JSON.stringify(pageDetail, 0, 2));
      await createTodayCheck(pageDetail)

      await notion.pages.update({
        page_id: pageDetail.id,
        properties: {
          Archive: {
            type: "checkbox",
            checkbox: true
          }
        }
      })
    }
  } catch (e) {
    console.error(e.message);
  }
})()