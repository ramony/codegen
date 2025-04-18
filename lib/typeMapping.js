export default [
  {
    "matchType": "REGEX",
    "columnType": "varchar(\\(\\d+\\))?",
    "javaType": "java.lang.String"
  },
  {
    "matchType": "REGEX",
    "columnType": "char(\\(\\d+\\))?",
    "javaType": "java.lang.String"
  },
  {
    "matchType": "ORDINARY",
    "columnType": "tinyint(1)",
    "javaType": "java.lang.Boolean"
  },
  {
    "matchType": "REGEX",
    "columnType": "(tiny|medium|long)*text",
    "javaType": "java.lang.String"
  },
  {
    "matchType": "REGEX",
    "columnType": "text",
    "javaType": "java.lang.String"
  },
  {
    "matchType": "REGEX",
    "columnType": "decimal(\\(\\d+,\\d+\\))?",
    "javaType": "java.math.BigDecimal"
  },
  {
    "matchType": "REGEX",
    "columnType": "decimal(\\(\\d+\\))?",
    "javaType": "java.lang.Long"
  },
  {
    "matchType": "ORDINARY",
    "columnType": "integer",
    "javaType": "java.lang.Integer"
  },
  {
    "matchType": "REGEX",
    "columnType": "(tiny|small|medium)*int(\\(\\d+\\))?",
    "javaType": "java.lang.Integer"
  },
  {
    "matchType": "ORDINARY",
    "columnType": "int4",
    "javaType": "java.lang.Integer"
  },
  {
    "matchType": "ORDINARY",
    "columnType": "int8",
    "javaType": "java.lang.Long"
  },
  {
    "matchType": "REGEX",
    "columnType": "bigint(\\(\\d+\\))?",
    "javaType": "java.lang.Long"
  },
  {
    "matchType": "ORDINARY",
    "columnType": "date",
    "javaType": "java.util.Date"
  },
  {
    "matchType": "ORDINARY",
    "columnType": "datetime",
    "javaType": "java.util.Date"
  },
  {
    "matchType": "ORDINARY",
    "columnType": "timestamp",
    "javaType": "java.util.Date"
  },
  {
    "matchType": "ORDINARY",
    "columnType": "time",
    "javaType": "java.time.LocalTime"
  },
  {
    "matchType": "ORDINARY",
    "columnType": "boolean",
    "javaType": "java.lang.Boolean"
  }
]