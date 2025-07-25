import { renderMarkdownTable } from "../markdownTable";

describe("renderMarkdownTable", () => {
  it("renders a basic table", () => {
    const input = {
      type: "table",
      caption: "Test Table",
      colLabels: ["Name", "Value"],
      rows: [["Foo", "1"], ["Bar", "2"]],
    };

    const result = renderMarkdownTable(input);
    expect(result).toBe(`

##### Test Table
| Name | Value |
| :-- | :-- |
| Foo | 1 |
| Bar | 2 |

`.trim());
  });
});