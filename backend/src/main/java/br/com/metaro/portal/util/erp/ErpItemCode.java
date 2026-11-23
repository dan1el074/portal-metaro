package br.com.metaro.portal.util.erp;

import java.util.Locale;

public final class ErpItemCode {
    private ErpItemCode() {}

    public static String normalize(String value) {
        if (value == null) return "";
        String code = value.trim().toUpperCase(Locale.ROOT);
        return code.matches("[0-9]+") ? code.replaceFirst("^0+(?!$)", "") : code;
    }
}
