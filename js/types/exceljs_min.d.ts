/**
 * Min-bundlad ExcelJS från exceljs.min.js saknar egna typer.
 */
declare module 'exceljs/dist/exceljs.min.js' {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ExcelJS: any;
    export default ExcelJS;
}
