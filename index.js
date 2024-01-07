import { convert } from "html-to-text";
import OpenAI from "openai";
import { encodingForModel } from "js-tiktoken";

const OPENAI_MODEL = "gpt-4-1106-preview";
const MAX_TOKENS = 128_000;

export async function handler(event) {
  const { url } = event.queryParameters;
  const html = await getUrlContent(url);
  const text = convert(html, { wordwrap: null });
  const data = await extractEntitiesWithAffiliations(text);
  return {
    statusCode: 200,
    body: JSON.stringify(data),
  };
}

async function getUrlContent(url, type = "text") {
  try {
    const response = await fetch(url);

    if (response.ok) {
      const data = await response[type]();
      return data;
    } else {
      console.log(`Error: ${url}`);
      console.error(`Error: ${response.status} - ${response.statusText}`);
      return null;
    }
  } catch (error) {
    console.log(`Error: ${url}`);
    console.error(`Error: ${error.message}`);
    return null;
  }
}

async function extractEntitiesWithAffiliations(text) {
  const openai = new OpenAI();
  text = truncateText(text);
  const chatCompletion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You will be provided with text from a web page that might include names of people or organizations (entities). Your task is to extract a list of entities and any relationships between them. Return the list of entities in a JSON array under the key 'entities'. Each entitiy should have the following fields: id, name, type. The id field should increment starting from 1. The type field's value should be either 'person' or 'organization'. Return the list of relationships in a JSON array under the key 'relationships'. Each relationship should have the following fields: entity1_id, entity2_id, and description. The entity1_id and entity2_id fields are the ids of the related entities from the 'entities' array. The description field should be a very concise description of the relationship between the two entities. If no entities are mentioned in the text then set 'entities' equal to an empty array. If no relationships are mentioned in the text then set 'relationships' equal to an empty array.`,
      },
      { role: "user", content: text },
    ],
  });

  const data = JSON.parse(chatCompletion.choices[0].message.content);
  return data;
}

function truncateText(text) {
  const encoding = encodingForModel(OPENAI_MODEL);
  const tokens = encoding.encode(text);
  const truncatedTokens = tokens.slice(0, MAX_TOKENS - 2000);
  const truncatedText = encoding.decode(truncatedTokens);
  return truncatedText;
}
