# 📖 Capítulo 05: Wiki y Gestión Documental

## 1. Descubrimiento Automático de Docs
- La solapa **Docs / Wiki** consulta automáticamente la carpeta `/docs` en la rama principal (`main`) de tu repositorio vía API de GitHub.
- Todos los archivos `.md` allí ubicados aparecen ordenados alfabéticamente en la barra lateral izquierda del visor.

## 2. Convención Recomendada de Nomenclatura
Para estructurar un manual técnico, guías de arquitectura o documentación de onboarding, se recomienda numerar los archivos con prefijo numérico de dos dígitos:

```text
docs/
├── 01-primeros-pasos.md
├── 02-arquitectura-backend.md
├── 03-guia-de-estilos.md
└── 04-despliegue-produccion.md
```

## 3. Renderizado y Edición
- Los documentos se procesan en vivo con `marked.js` garantizando soporte completo para encabezados, tablas, listas y bloques de código.
- Los miembros autorizados pueden crear nuevos documentos directamente desde la interfaz mediante el botón **➕ Nuevo Doc**.
