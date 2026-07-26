import { UtilsPoFile } from "./utils-po-file";

describe('UtilsPoFile.extractPoToJson', () => {
  it('extracts Poedit PO entries and ignores empty translations', () => {
    const poContent = `
msgid ""
msgstr ""
"Project-Id-Version: \\\\n"
"Language: de_DE\\\\n"
"Content-Type: text/plain; charset=UTF-8\\\\n"
"X-Generator: Poedit 3.9\\\\n"

#: lib/gm-special-draw-api/gm-special-draw.model.ts
msgid "13-er Ergebniswette"
msgstr ""

#: lib/gm-messages/gm-messages.ts
msgid "Device not found"
msgstr "Gerät nicht gefunden"

#: lib/gm-messages/gm-messages.ts
msgid "Discount amount exceeds minimum amount"
msgstr " "

#: lib/gm-messages/gm-messages.ts lib/gm-messages/gm-rpc-generated-errors.ts
msgid "Data corrupted"
msgstr "Daten beschädigt"
`;

    const result = UtilsPoFile.extractPoToJson(poContent);

    expect(result).toEqual([
      {
        fileAbsPath:
          'lib/gm-special-draw-api/gm-special-draw.model.ts',
        fileRelativePath:
          'lib/gm-special-draw-api/gm-special-draw.model.ts',
        tags: [
          {
            lineNumber: 0,
            gettextString: '13-er Ergebniswette',
            context: undefined,
            translation: undefined,
          },
        ],
      },
      {
        fileAbsPath: 'lib/gm-messages/gm-messages.ts',
        fileRelativePath: 'lib/gm-messages/gm-messages.ts',
        tags: [
          {
            lineNumber: 0,
            gettextString: 'Device not found',
            context: undefined,
            translation: 'Gerät nicht gefunden',
          },
          {
            lineNumber: 0,
            gettextString:
              'Discount amount exceeds minimum amount',
            context: undefined,
            translation: undefined,
          },
          {
            lineNumber: 0,
            gettextString: 'Data corrupted',
            context: undefined,
            translation: 'Daten beschädigt',
          },
        ],
      },
      {
        fileAbsPath:
          'lib/gm-messages/gm-rpc-generated-errors.ts',
        fileRelativePath:
          'lib/gm-messages/gm-rpc-generated-errors.ts',
        tags: [
          {
            lineNumber: 0,
            gettextString: 'Data corrupted',
            context: undefined,
            translation: 'Daten beschädigt',
          },
        ],
      },
    ]);
  });

  it('supports references containing line numbers', () => {
    const poContent = `
#: lib/example.ts:15 lib/second.ts:31
msgid "Device not found"
msgstr "Gerät nicht gefunden"
`;

    expect(UtilsPoFile.extractPoToJson(poContent)).toEqual([
      {
        fileAbsPath: 'lib/example.ts',
        fileRelativePath: 'lib/example.ts',
        tags: [
          {
            lineNumber: 15,
            gettextString: 'Device not found',
            context: undefined,
            translation: 'Gerät nicht gefunden',
          },
        ],
      },
      {
        fileAbsPath: 'lib/second.ts',
        fileRelativePath: 'lib/second.ts',
        tags: [
          {
            lineNumber: 31,
            gettextString: 'Device not found',
            context: undefined,
            translation: 'Gerät nicht gefunden',
          },
        ],
      },
    ]);
  });

  it('supports PO files containing UTF-8 BOM', () => {
    const poContent =
      '\uFEFF' +
      `
msgid ""
msgstr ""
"Language: de_DE\\\\n"

#: lib/example.ts:4
msgid "Access prohibited"
msgstr "Zugriff verboten"
`;

    const result = UtilsPoFile.extractPoToJson(poContent);

    expect(result[0]?.tags[0]?.translation).toBe(
      'Zugriff verboten',
    );
  });

  it('escapes translations when generating PO content', () => {
    const result = UtilsPoFile.generatePoFileContent(
      [
        {
          fileAbsPath: '/project/lib/example.ts',
          fileRelativePath: 'lib/example.ts',
          tags: [
            {
              lineNumber: 10,
              gettextString: 'Displayed "message"',
              translation: 'Eine "Nachricht"\\nmit neuer Zeile',
            },
          ],
        },
      ],
      'de-DE',
    );

    expect(result).toContain(
      'msgid "Displayed \\"message\\""',
    );

    expect(result).toContain(
      'msgstr "Eine \\"Nachricht\\"\\\\nmit neuer Zeile"',
    );
  });
});
