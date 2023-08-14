import { Client } from "@notionhq/client"

const notion = new Client({ auth: process.env.NOTION_API_KEY })

const databaseId = process.env.DAILY_CHECKOUT_DB_ID

const DAY_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function genNewTitle () {
  const date = new Date();

  const options = {
    timeZone: "Asia/Shanghai",
    month: '2-digit',
    day: '2-digit'
  };

  return `${date.toLocaleString('en-US', options)} ${DAY_OF_WEEK[date.getDay()]} Check`;
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
    console.log(JSON.stringify(oldPageBlocks.results[10], 0, 2))
    // console.log(genPropsFromOld(oldPage.properties))
    const newPage = await notion.pages.create({
      properties: genPropsFromOld(oldPage.properties),
      // content: oldPageBlocks.results.filter(block => block.type !== 'unsupported'),
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
      // console.log(JSON.stringify(pageDetail, 0, 2));
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