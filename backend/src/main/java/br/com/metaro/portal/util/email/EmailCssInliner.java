package br.com.metaro.portal.util.email;

import br.com.metaro.portal.util.email.dto.CssBlockDto;
import br.com.metaro.portal.util.email.dto.ParsedCssDeclarationDto;
import br.com.metaro.portal.util.email.dto.CssDeclarationDto;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Entities;
import org.jsoup.select.Selector;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class EmailCssInliner {
    private static final Pattern CSS_COMMENT = Pattern.compile("/\\*.*?\\*/", Pattern.DOTALL);
    private static final Pattern CSS_IMPORT = Pattern.compile("@import\\s+[^;]+;", Pattern.CASE_INSENSITIVE);
    private static final Pattern IMPORTANT = Pattern.compile("\\s*!important\\s*$", Pattern.CASE_INSENSITIVE);
    private static final Pattern ID_SELECTOR = Pattern.compile("#[a-zA-Z0-9_-]+");
    private static final Pattern CLASS_OR_ATTRIBUTE_SELECTOR = Pattern.compile("(?:\\.[a-zA-Z0-9_-]+|\\[[^]]+]|:(?!:)[a-zA-Z0-9_-]+)");
    private static final Pattern ELEMENT_SELECTOR = Pattern.compile("(?:^|[\\s>+~])([a-zA-Z][a-zA-Z0-9_-]*|\\*)");

    private EmailCssInliner() {
    }

    static String inline(String html) {
        Document document = Jsoup.parse(html);
        document.outputSettings()
                .charset(StandardCharsets.UTF_8)
                .escapeMode(Entities.EscapeMode.base)
                .prettyPrint(false);

        List<Element> styleElements = new ArrayList<>(document.select("style"));
        if (styleElements.isEmpty()) {
            return html;
        }

        Map<Element, LinkedHashMap<String, CssDeclarationDto>> declarationsByElement = new LinkedHashMap<>();
        StringBuilder retainedCss = new StringBuilder();
        int sourceOrder = 0;

        for (Element styleElement : styleElements) {
            String css = CSS_COMMENT.matcher(styleElement.data()).replaceAll("");
            Matcher importMatcher = CSS_IMPORT.matcher(css);
            while (importMatcher.find()) {
                appendRetainedCss(retainedCss, importMatcher.group());
            }
            css = importMatcher.replaceAll("");

            for (CssBlockDto block : parseTopLevelBlocks(css)) {
                if (block.getSelector().startsWith("@")) {
                    appendRetainedCss(retainedCss, block.getSelector() + "{" + block.getContent() + "}");
                    continue;
                }

                List<ParsedCssDeclarationDto> ruleDeclarations = parseDeclarations(block.getContent());
                if (ruleDeclarations.isEmpty()) {
                    continue;
                }

                sourceOrder++;
                for (String selector : splitTopLevel(block.getSelector(), ',')) {
                    String normalizedSelector = selector.trim();
                    if (normalizedSelector.isEmpty()) {
                        continue;
                    }
                    boolean applied = applyRule(
                            document,
                            declarationsByElement,
                            normalizedSelector,
                            ruleDeclarations,
                            sourceOrder
                    );
                    if (!applied) {
                        appendRetainedCss(retainedCss, normalizedSelector + "{" + block.getContent() + "}");
                    }
                }
            }
        }

        applyExistingInlineStyles(document, declarationsByElement);
        writeInlineStyles(declarationsByElement);

        styleElements.forEach(Element::remove);
        if (!retainedCss.isEmpty()) {
            document.head().appendElement("style").appendText(retainedCss.toString());
        }
        return document.outerHtml();
    }

    private static boolean applyRule(
            Document document,
            Map<Element, LinkedHashMap<String, CssDeclarationDto>> declarationsByElement,
            String selector,
            List<ParsedCssDeclarationDto> declarations,
            int sourceOrder
    ) {
        int specificity = specificity(selector);
        try {
            for (Element element : document.select(selector)) {
                LinkedHashMap<String, CssDeclarationDto> elementDeclarations = declarationsByElement
                        .computeIfAbsent(element, ignored -> new LinkedHashMap<>());
                for (ParsedCssDeclarationDto declaration : declarations) {
                    merge(elementDeclarations, declaration, specificity, sourceOrder);
                }
            }
            return true;
        } catch (Selector.SelectorParseException ignored) {
            return false;
        }
    }

    private static void applyExistingInlineStyles(
            Document document,
            Map<Element, LinkedHashMap<String, CssDeclarationDto>> declarationsByElement
    ) {
        for (Element element : document.select("[style]")) {
            LinkedHashMap<String, CssDeclarationDto> elementDeclarations = declarationsByElement
                    .computeIfAbsent(element, ignored -> new LinkedHashMap<>());
            for (ParsedCssDeclarationDto declaration : parseDeclarations(element.attr("style"))) {
                merge(elementDeclarations, declaration, 1_000, Integer.MAX_VALUE);
            }
        }
    }

    private static void merge(
            LinkedHashMap<String, CssDeclarationDto> declarations,
            ParsedCssDeclarationDto candidate,
            int specificity,
            int sourceOrder
    ) {
        CssDeclarationDto current = declarations.get(candidate.getProperty());
        CssDeclarationDto replacement = new CssDeclarationDto(candidate.getValue(), candidate.isImportant(), specificity, sourceOrder);
        if (current == null || hasPriorityOver(replacement, current)) {
            declarations.put(candidate.getProperty(), replacement);
        }
    }

    private static void writeInlineStyles(Map<Element, LinkedHashMap<String, CssDeclarationDto>> declarationsByElement) {
        declarationsByElement.forEach((element, declarations) -> {
            StringBuilder style = new StringBuilder();
            declarations.forEach((property, declaration) -> {
                if (!style.isEmpty()) {
                    style.append(';');
                }
                style.append(property).append(':').append(declaration.getValue());
                if (declaration.isImportant()) {
                    style.append(" !important");
                }
            });
            element.attr("style", style.toString());
        });
    }

    private static List<CssBlockDto> parseTopLevelBlocks(String css) {
        List<CssBlockDto> blocks = new ArrayList<>();
        int cursor = 0;
        while (cursor < css.length()) {
            int openBrace = css.indexOf('{', cursor);
            if (openBrace < 0) {
                break;
            }
            String selector = css.substring(cursor, openBrace).trim();
            int closeBrace = matchingBrace(css, openBrace);
            if (closeBrace < 0) {
                break;
            }
            if (!selector.isEmpty()) {
                blocks.add(new CssBlockDto(selector, css.substring(openBrace + 1, closeBrace)));
            }
            cursor = closeBrace + 1;
        }
        return blocks;
    }

    private static int matchingBrace(String css, int openBrace) {
        int depth = 0;
        char quote = 0;
        for (int index = openBrace; index < css.length(); index++) {
            char character = css.charAt(index);
            if (quote != 0) {
                if (character == quote && css.charAt(index - 1) != '\\') {
                    quote = 0;
                }
                continue;
            }
            if (character == '\'' || character == '"') {
                quote = character;
            } else if (character == '{') {
                depth++;
            } else if (character == '}' && --depth == 0) {
                return index;
            }
        }
        return -1;
    }

    private static List<ParsedCssDeclarationDto> parseDeclarations(String css) {
        List<ParsedCssDeclarationDto> declarations = new ArrayList<>();
        for (String declaration : splitTopLevel(css, ';')) {
            int colon = declaration.indexOf(':');
            if (colon <= 0) {
                continue;
            }
            String property = declaration.substring(0, colon).trim().toLowerCase(Locale.ROOT);
            String value = declaration.substring(colon + 1).trim();
            if (property.isEmpty() || value.isEmpty()) {
                continue;
            }
            Matcher importantMatcher = IMPORTANT.matcher(value);
            boolean important = importantMatcher.find();
            if (important) {
                value = value.substring(0, importantMatcher.start()).trim();
            }
            declarations.add(new ParsedCssDeclarationDto(property, value, important));
        }
        return declarations;
    }

    private static List<String> splitTopLevel(String value, char delimiter) {
        List<String> parts = new ArrayList<>();
        int start = 0;
        int parentheses = 0;
        int brackets = 0;
        char quote = 0;
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (quote != 0) {
                if (character == quote && (index == 0 || value.charAt(index - 1) != '\\')) {
                    quote = 0;
                }
            } else if (character == '\'' || character == '"') {
                quote = character;
            } else if (character == '(') {
                parentheses++;
            } else if (character == ')') {
                parentheses--;
            } else if (character == '[') {
                brackets++;
            } else if (character == ']') {
                brackets--;
            } else if (character == delimiter && parentheses == 0 && brackets == 0) {
                parts.add(value.substring(start, index));
                start = index + 1;
            }
        }
        parts.add(value.substring(start));
        return parts;
    }

    private static int specificity(String selector) {
        int ids = countMatches(ID_SELECTOR, selector);
        int classesAndAttributes = countMatches(CLASS_OR_ATTRIBUTE_SELECTOR, selector);
        int elements = 0;
        Matcher elementMatcher = ELEMENT_SELECTOR.matcher(selector);
        while (elementMatcher.find()) {
            if (!"*".equals(elementMatcher.group(1))) {
                elements++;
            }
        }
        return ids * 100 + classesAndAttributes * 10 + elements;
    }

    private static int countMatches(Pattern pattern, String value) {
        int count = 0;
        Matcher matcher = pattern.matcher(value);
        while (matcher.find()) {
            count++;
        }
        return count;
    }

    private static void appendRetainedCss(StringBuilder retainedCss, String css) {
        if (!retainedCss.isEmpty()) {
            retainedCss.append('\n');
        }
        retainedCss.append(css.trim());
    }

    private static boolean hasPriorityOver(CssDeclarationDto candidate, CssDeclarationDto current) {
        if (candidate.isImportant() != current.isImportant()) {
            return candidate.isImportant();
        }
        if (candidate.getSpecificity() != current.getSpecificity()) {
            return candidate.getSpecificity() > current.getSpecificity();
        }
        return candidate.getSourceOrder() >= current.getSourceOrder();
    }
}
