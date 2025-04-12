const settings = {
  taskExample: {
    "database": {
      "host": "localhost",
      "port": 3306,
      "user": "mysql_user",
      "password": "mysql_password",
      "database": "mysql_database"
    },
    "tableNames": [
      "test_table"
    ],
    "preSet": [
      "Controller",
      "DO"
    ],
    "templateName": "example",
    "dist": "./dist",
    "prefixPackage": "com.example"
  },
  templateExample: {
    global: '',
    controller: '\
$!package("controller.$!{tablepath}")\n\
$!save("controller/$!{tablepath}/$!{TableController}.java")\n\
\n\
public class $!{TableController} {\n\
  \n\
}',
    dataobject: '\
$!package("dal.$!{tablepath}")\n\
$!save("dal/$!{tablepath}/$!{TableDO}.java")\n\
\n\
#set($tableFields = $filter($tableFields, ["id"]))\n\
\n\
$!importTypes($tableFields)\n\
\n\
/***\n\
 * $!{tableComment}\n\
 */\n\
public class $!{TableDO} {\n\
\n\
  #foreach( $it in $tableFields )\n\
    \n\
    // $!{it.fieldComment}\n\
    private ${it.type} ${it.field};\n\
\n\
  #end\n\
}\n\
 '
  }

}

export default settings;