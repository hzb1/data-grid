import type { ElDatePicker, ElInput, ElInputNumber, ElSelect, ElSwitch } from 'element-plus'
import type { Component, ComputedRef, InputHTMLAttributes, Ref } from 'vue'

/**
 * DataGrid 当前的交互模式。
 *
 * - `view`：只读查看数据，不开放单元格编辑能力。
 * - `edit`：允许符合列配置和禁用条件的单元格进入编辑状态。
 */
export type DataGridMode = 'view' | 'edit'

/** DataGrid 可接收的通用业务行。 */
export type DataGridRow = Record<string, unknown>

/** DataGrid 在业务行中保留的系统字段名。 */
export type DataGridSystemField = '__dataGridRowKey'

/** 业务侧显式使用 DataGrid 前端行标识字段时可继承的行类型。 */
export interface DataGridKeyedRow {
  /** 当前行在前端生命周期内保持稳定的唯一标识。 */
  readonly __dataGridRowKey: DataGridRowKey
}

/** 从业务行中提取出的可配置业务字段名。 */
export type DataGridField<Row> = Exclude<Extract<keyof Row, string>, DataGridSystemField>

/** DataGrid 行标识使用的字段名或解析函数。 */
export type DataGridRowKeyResolver<Row> =
  | Extract<keyof Row, string>
  | ((row: Row) => DataGridRowKey)

/**
 * DataGrid 开发诊断的输出级别。
 *
 * - `info`：普通诊断信息，用于说明回退策略或非阻断状态。
 * - `warning`：需要关注但不会立即阻止表格运行的配置问题。
 * - `error`：可能导致功能失效或数据定位错误的严重问题。
 */
export type DataGridDiagnosticLevel = 'info' | 'warning' | 'error'

/**
 * DataGrid 开发诊断的稳定编码。
 *
 * - `DG-COLUMN-001`：没有配置业务列。
 * - `DG-COLUMN-002`：列字段为空。
 * - `DG-COLUMN-003`：列标题为空。
 * - `DG-COLUMN-004`：列宽或弹性权重不是有效正数。
 * - `DG-COLUMN-005`：列最小宽度大于最大宽度。
 * - `DG-COLUMN-006`：多个业务列使用了重复字段。
 * - `DG-FILTER-001`：筛选器包含当前搜索类型不支持的运算符。
 * - `DG-FILTER-002`：默认筛选运算符不在有效运算符集合中。
 * - `DG-OPTION-002`：同一列存在重复的选项值。
 * - `DG-OPTION-003`：选项名称或别名无法唯一匹配。
 * - `DG-SUMMARY-001`：自定义汇总方式缺少计算函数。
 * - `DG-SLOT-001`：单元格插槽无法匹配业务列。
 * - `DG-ROW-001`：强依赖稳定行标识时，业务行无法解析出有效行标识。
 * - `DG-ROW-002`：强依赖稳定行标识时，多行业务数据使用了重复行标识。
 * - `DG-ROW-003`：保留的历史诊断编码，普通场景允许使用组件生成的临时行标识。
 * - `DG-ROW-004`：需要稳定行标识的功能正在使用临时行标识。
 * - `DG-ROW-005`：受控选中行标识包含无效值。
 * - `DG-ROW-006`：受控选中行标识包含重复值。
 * - `DG-ROW-007`：强依赖行标识的功能未显式声明 rowKey。
 * - `DG-FEATURE-001`：关闭校验引擎后仍配置了校验规则。
 * - `DG-FEATURE-002`：异步校验并发数小于有效下限。
 * - `DG-FEATURE-003`：保留的历史诊断编码，当前版本不再输出。
 * - `DG-FEATURE-004`：保留的历史诊断编码，当前版本不再输出。
 * - `DG-FEATURE-005`：保留的历史诊断编码，当前版本不再输出。
 * - `DG-FEATURE-006`：历史记录容量不是有效正整数。
 * - `DG-FEATURE-007`：分页序号参数不是有效正整数。
 * - `DG-SETTING-001`：列配置缓存标识为空。
 * - `DG-SETTING-002`：列配置最少可见列数超出有效范围。
 * - `DG-SETTING-003`：列配置缓存结构无效。
 * - `DG-SETTING-004`：列配置缓存版本与当前版本不兼容。
 * - `DG-SETTING-005`：列配置缓存修订号与当前配置不兼容。
 * - `DG-SETTING-006`：列配置缓存存储操作失败。
 * - `DG-SETTING-007`：AG Grid 未能完整应用列配置。
 * - `DG-SETTING-008`：无法读取当前租户标识。
 * - `DG-MERGE-001`：同一字段同时属于多个合并区域。
 * - `DG-MERGE-002`：合并单元格同时配置了编辑器。
 * - `DG-MERGE-003`：行合并配置引用了不存在的字段。
 * - `DG-MERGE-004`：列合并字段列表无效或不连续。
 * - `DG-MERGE-005`：列顺序、固定区域或列配置可能破坏列合并。
 */
export type DataGridDiagnosticCode =
  | 'DG-COLUMN-001'
  | 'DG-COLUMN-002'
  | 'DG-COLUMN-003'
  | 'DG-COLUMN-004'
  | 'DG-COLUMN-005'
  | 'DG-COLUMN-006'
  | 'DG-FILTER-001'
  | 'DG-FILTER-002'
  | 'DG-OPTION-002'
  | 'DG-OPTION-003'
  | 'DG-SUMMARY-001'
  | 'DG-SLOT-001'
  | 'DG-ROW-001'
  | 'DG-ROW-002'
  | 'DG-ROW-003'
  | 'DG-ROW-004'
  | 'DG-ROW-005'
  | 'DG-ROW-006'
  | 'DG-ROW-007'
  | 'DG-FEATURE-001'
  | 'DG-FEATURE-002'
  | 'DG-FEATURE-003'
  | 'DG-FEATURE-004'
  | 'DG-FEATURE-005'
  | 'DG-FEATURE-006'
  | 'DG-FEATURE-007'
  | 'DG-SETTING-001'
  | 'DG-SETTING-002'
  | 'DG-SETTING-003'
  | 'DG-SETTING-004'
  | 'DG-SETTING-005'
  | 'DG-SETTING-006'
  | 'DG-SETTING-007'
  | 'DG-SETTING-008'
  | 'DG-MERGE-001'
  | 'DG-MERGE-002'
  | 'DG-MERGE-003'
  | 'DG-MERGE-004'
  | 'DG-MERGE-005'

/** DataGrid 单条开发诊断信息。 */
export interface DataGridDiagnostic {
  /** 供文档、测试和检索使用的稳定诊断编码。 */
  code: DataGridDiagnosticCode

  /** 当前问题的输出级别。 */
  level: DataGridDiagnosticLevel

  /** 当前问题的简明说明。 */
  message: string

  /** 开发人员可采用的修复建议。 */
  suggestion?: string

  /** 不包含完整业务行和敏感数据的定位上下文。 */
  context?: Record<string, unknown>
}

/** DataGrid 开发诊断配置。 */
export interface DataGridDiagnosticsConfig {
  /** 是否启用诊断；未配置时默认仅在开发环境启用。 */
  enabled?: boolean

  /** 最低输出级别，默认 warning。 */
  level?: DataGridDiagnosticLevel

  /** 当前表格在控制台中使用的开发定位名称。 */
  name?: string

  /** 是否在控制台输出结构化定位上下文，默认启用。 */
  includeContext?: boolean
}

/**
 * DataGrid 对外使用的稳定行唯一标识。
 *
 * - `string`：使用非空字符串标识业务行。
 * - `number`：使用有限数字标识业务行。
 */
export type DataGridRowKey = string | number

/**
 * DataGrid 单元格 Loading 的业务来源。
 *
 * - `validation`：正在执行同步或异步业务校验。
 * - `processing`：正在执行通用数据处理。
 * - `saving`：正在向外部服务保存数据。
 * - `custom`：由业务方自定义的异步任务。
 */
export type DataGridCellLoadingType = 'validation' | 'processing' | 'saving' | 'custom'

/** DataGrid 单元格 Loading 任务的展示和交互选项。 */
export interface DataGridCellLoadingOptions {
  /** 当前任务的业务来源，默认 processing。 */
  type?: DataGridCellLoadingType

  /** 当前任务用于单元格 Tooltip 和无障碍说明的简短提示，不会作为单元格内容直接展示。 */
  text?: string

  /** 当前任务未完成时是否阻止编辑、粘贴和清空，默认阻止。 */
  blockInteraction?: boolean
}

/** DataGrid 单元格 Loading 任务令牌。 */
export interface DataGridCellLoadingTask {
  /** 幂等结束当前任务；同一令牌重复调用不会影响其他并发任务。 */
  finish(): void
}

/** DataGrid 单元格 Loading 当前用于渲染的状态。 */
export interface DataGridCellLoadingRenderState {
  /** 当前 Loading 是否已经超过延迟并进入可见阶段。 */
  visible: boolean

  /** 当前按任务优先级选中的业务来源。 */
  type: DataGridCellLoadingType

  /** 当前 Loading 用于单元格 Tooltip 和无障碍说明的简短提示。 */
  text?: string

  /** 当前仍未完成的任务中是否存在阻止修改的任务。 */
  blockInteraction: boolean
}

/**
 * DataGrid 支持的表头搜索控件类型。
 *
 * - `text`：文本输入筛选。
 * - `number`：单个数值筛选。
 * - `numberRange`：数值区间筛选。
 * - `date`：日期筛选。
 * - `dateRange`：日期区间筛选。
 * - `datetime`：日期时间筛选。
 * - `datetimeRange`：日期时间区间筛选。
 * - `select`：单选选项筛选。
 * - `multiSelect`：多选选项筛选。
 * - `boolean`：布尔值筛选。
 */
export type DataGridSearchType =
  | 'text'
  | 'number'
  | 'numberRange'
  | 'date'
  | 'dateRange'
  | 'datetime'
  | 'datetimeRange'
  | 'select'
  | 'multiSelect'
  | 'boolean'

/**
 * DataGrid 文本筛选支持的比较运算符。
 *
 * - `contains`：字段文本包含筛选值。
 * - `equals`：字段文本与筛选值完全相等。
 * - `notEqual`：字段文本与筛选值不相等。
 * - `startsWith`：字段文本以筛选值开头。
 * - `endsWith`：字段文本以筛选值结尾。
 */
export type DataGridTextOperator = 'contains' | 'equals' | 'notEqual' | 'startsWith' | 'endsWith'

/**
 * DataGrid 数值筛选支持的比较运算符。
 *
 * - `equals`：字段值等于筛选值。
 * - `notEqual`：字段值不等于筛选值。
 * - `greaterThan`：字段值大于筛选值。
 * - `greaterThanOrEqual`：字段值大于或等于筛选值。
 * - `lessThan`：字段值小于筛选值。
 * - `lessThanOrEqual`：字段值小于或等于筛选值。
 */
export type DataGridNumberOperator =
  | 'equals'
  | 'notEqual'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'

/**
 * DataGrid 日期筛选支持的比较运算符。
 *
 * - `equals`：日期值等于筛选值。
 * - `notEqual`：日期值不等于筛选值。
 * - `greaterThan`：日期值晚于筛选值。
 * - `greaterThanOrEqual`：日期值晚于或等于筛选值。
 * - `lessThan`：日期值早于筛选值。
 * - `lessThanOrEqual`：日期值早于或等于筛选值。
 */
export type DataGridDateOperator = DataGridNumberOperator

/**
 * DataGrid 全部筛选类型共用的运算符集合。
 *
 * - `contains`：文本包含筛选值。
 * - `equals`：字段值等于筛选值。
 * - `notEqual`：字段值不等于筛选值。
 * - `startsWith`：文本以筛选值开头。
 * - `endsWith`：文本以筛选值结尾。
 * - `greaterThan`：字段值大于筛选值。
 * - `greaterThanOrEqual`：字段值大于或等于筛选值。
 * - `lessThan`：字段值小于筛选值。
 * - `lessThanOrEqual`：字段值小于或等于筛选值。
 * - `inRange`：字段值位于起止值构成的范围内。
 * - `in`：字段值存在于给定选项集合中。
 */
export type DataGridFilterOperator =
  | DataGridTextOperator
  | DataGridNumberOperator
  | 'inRange'
  | 'in'

/** DataGrid 筛选控件的基础配置。 */
export interface DataGridBaseFilterConfig {
  /** 筛选输入控件未填写时展示的提示文字。 */
  placeholder?: string

  /** 筛选控件是否允许一键清空当前值。 */
  clearable?: boolean
}

/** DataGrid 支持运算符切换的筛选配置。 */
export interface DataGridOperatorFilterConfig<
  Operator extends DataGridFilterOperator,
> extends DataGridBaseFilterConfig {
  /** 当前筛选控件允许用户选择的运算符。 */
  operators?: Operator[]

  /** 当前筛选控件首次打开时使用的默认运算符。 */
  defaultOperator?: Operator
}

/**
 * DataGrid 各搜索控件对应的筛选配置。
 *
 * - 文本分支：使用 `text` 和文本比较运算符。
 * - 数值分支：使用 `number` 和数值比较运算符。
 * - 日期分支：使用 `date` 或 `datetime` 和日期比较运算符。
 * - 范围或选项分支：使用范围、单选、多选或布尔筛选控件。
 * - 无搜索分支：不提供表头搜索控件，仅允许显式关闭筛选。
 */
export type DataGridSearchConfig =
  | {
      /** 使用文本输入控件执行筛选。 */
      searchType: 'text'

      /**
       * 文本筛选配置。
       *
       * - `false`：关闭当前列筛选。
       * - 配置对象：限制可用文本运算符并设置默认运算符。
       */
      filter?: false | DataGridOperatorFilterConfig<DataGridTextOperator>
    }
  | {
      /** 使用数字输入控件执行筛选。 */
      searchType: 'number'

      /**
       * 数值筛选配置。
       *
       * - `false`：关闭当前列筛选。
       * - 配置对象：限制可用数值运算符并设置默认运算符。
       */
      filter?: false | DataGridOperatorFilterConfig<DataGridNumberOperator>
    }
  | {
      /**
       * 使用日期类控件执行筛选。
       *
       * - `date`：仅筛选日期部分。
       * - `datetime`：同时筛选日期和时间。
       */
      searchType: 'date' | 'datetime'

      /**
       * 日期筛选配置。
       *
       * - `false`：关闭当前列筛选。
       * - 配置对象：限制可用日期运算符并设置默认运算符。
       */
      filter?: false | DataGridOperatorFilterConfig<DataGridDateOperator>
    }
  | {
      /**
       * 使用无需切换比较运算符的筛选控件。
       *
       * - `numberRange`：筛选数值区间。
       * - `dateRange`：筛选日期区间。
       * - `datetimeRange`：筛选日期时间区间。
       * - `select`：筛选单个选项。
       * - `multiSelect`：筛选多个选项。
       * - `boolean`：筛选布尔值。
       */
      searchType:
        | 'numberRange'
        | 'dateRange'
        | 'datetimeRange'
        | 'select'
        | 'multiSelect'
        | 'boolean'

      /**
       * 当前筛选控件的基础配置。
       *
       * - `false`：关闭当前列筛选。
       * - 配置对象：设置提示文字和清空能力。
       */
      filter?: false | DataGridBaseFilterConfig
    }
  | {
      /** 当前列不提供表头搜索控件。 */
      searchType?: undefined

      /** 未配置搜索控件时仅允许显式关闭筛选。 */
      filter?: false
    }

/** DataGrid 内部保存的单列筛选模型。 */
export interface DataGridFilterModel {
  /** 用于识别 DataGrid 自定义筛选模型的固定类型。 */
  filterType: 'dataGrid'

  /** 当前筛选模型使用的搜索控件类型。 */
  searchType: DataGridSearchType

  /** 当前筛选条件使用的比较运算符。 */
  operator: DataGridFilterOperator

  /** 当前筛选条件的主值。 */
  value: unknown

  /** 范围筛选条件的结束值。 */
  valueTo?: unknown
}

/** DataGrid 对外抛出的单列筛选条件。 */
export interface DataGridFilterItem<Row = DataGridRow> {
  /** 当前筛选条件对应的业务字段。 */
  field: DataGridField<Row>

  /** 当前筛选条件使用的比较运算符。 */
  operator: DataGridFilterOperator

  /** 当前筛选条件的主值。 */
  value: unknown

  /** 范围筛选条件的结束值。 */
  valueTo?: unknown
}

/** DataGrid 对外抛出的单列排序条件。 */
export interface DataGridSortItem<Row = DataGridRow> {
  /** 当前排序条件对应的业务字段。 */
  field: DataGridField<Row>

  /**
   * 当前字段采用的排序方向。
   *
   * - `asc`：按字段值升序排列。
   * - `desc`：按字段值降序排列。
   */
  order: 'asc' | 'desc'
}

/** DataGrid 选择类字段使用的单个选项。 */
export interface DataGridOption<Value = unknown> {
  /** 当前选项面向用户展示的名称。 */
  label: string

  /** 当前选项写入业务行的实际值。 */
  value: Value

  /** 粘贴匹配时可识别的其他文本名称。 */
  aliases?: string[]

  /** 当前选项是否禁止用户选择。 */
  disabled?: boolean
}

/**
 * DataGrid 支持的静态或响应式配置值。
 *
 * - `T`：直接使用静态配置值。
 * - `Ref<T>`：读取可由业务代码主动更新的响应式值。
 * - `ComputedRef<T>`：读取由其他响应式状态派生的只读值。
 */
export type DataGridReactiveValue<T> = T | Ref<T> | ComputedRef<T>

/** DataGrid 选择类字段支持的静态或响应式选项来源。 */
export type DataGridOptionsSource<Value = unknown> = DataGridReactiveValue<
  readonly DataGridOption<Value>[]
>

/** 从 Vue 组件构造类型中提取公开 Props。 */
type DataGridComponentPublicProps<ComponentType> = ComponentType extends abstract new (
  ...args: never[]
) => {
  /** Vue 组件实例公开的 Props 类型。 */
  $props: infer Props
}
  ? Props
  : never

/**
 * DataGrid 内部统一接管、不允许业务配置透传覆盖的编辑器属性。
 *
 * - `modelValue`：由当前单元格原始值控制。
 * - `disabled`：由表格模式、禁用状态和列级编辑条件控制。
 * - `readonly`：由 DataGrid 的只读判断控制。
 * - `type`：由编辑器类型映射控制。
 * - `multiple`：由单选或多选编辑器类型控制。
 * - `teleported`：由 DataGrid 浮层策略控制。
 * - `popperClass`：由 DataGrid 浮层样式控制。
 * - `onUpdate:modelValue`：由 DataGrid 草稿更新链路控制。
 * - `onKeydown`：由 DataGrid 键盘交互链路控制。
 * - `onKeyup`：由 DataGrid 键盘交互链路控制。
 * - `onKeypress`：由 DataGrid 键盘交互链路控制。
 */
type DataGridControlledComponentProps =
  | 'modelValue'
  | 'disabled'
  | 'readonly'
  | 'type'
  | 'multiple'
  | 'teleported'
  | 'popperClass'
  | 'onUpdate:modelValue'
  | 'onKeydown'
  | 'onKeyup'
  | 'onKeypress'

/** DataGrid 编辑器允许透传给基础组件的属性。 */
type DataGridComponentProps<ComponentType> = Partial<
  Omit<
    DataGridComponentPublicProps<ComponentType>,
    Extract<keyof DataGridComponentPublicProps<ComponentType>, DataGridControlledComponentProps>
  >
>

/** DataGrid 文本编辑器允许透传的 Element Plus 与原生输入属性。 */
export type DataGridInputComponentProps = DataGridComponentProps<typeof ElInput> &
  Partial<
    Omit<InputHTMLAttributes, Extract<keyof InputHTMLAttributes, DataGridControlledComponentProps>>
  >

/** DataGrid 数字编辑器允许透传的 Element Plus 属性。 */
export type DataGridInputNumberComponentProps = DataGridComponentProps<typeof ElInputNumber>

/** DataGrid 日期编辑器允许透传的 Element Plus 属性。 */
export type DataGridDatePickerComponentProps = DataGridComponentProps<typeof ElDatePicker>

/** DataGrid 选择编辑器允许透传的 Element Plus 属性。 */
export type DataGridSelectComponentProps = DataGridComponentProps<typeof ElSelect>

/** DataGrid 布尔编辑器允许透传的 Element Plus 属性。 */
export type DataGridSwitchComponentProps = DataGridComponentProps<typeof ElSwitch>

/** DataGrid 判断单元格是否可编辑时提供的上下文。 */
export interface DataGridEditorContext<Row> {
  /** 当前单元格所属的完整业务行。 */
  row: Row

  /** 当前业务行在原始受控数组中的位置。 */
  dataIndex: number

  /** 当前业务行在排序和筛选后的视图位置。 */
  displayIndex: number

  /** 当前单元格对应的业务字段。 */
  field: DataGridField<Row>

  /** 当前单元格未经格式化的原始值。 */
  value: unknown
}

/** DataGrid 生成单元格业务 Tooltip 时提供的字段上下文。 */
export interface DataGridTooltipContext<Row> extends DataGridEditorContext<Row> {
  /** 当前字段经过列格式化和选项映射后的展示文本。 */
  formattedValue: string
}

/**
 * DataGrid 普通内容 Tooltip 的展示方式。
 *
 * - `always`：只要格式化文本非空就展示。
 * - `overflow`：仅当前单元格内容实际被截断时展示。
 */
export type DataGridTooltipMode = 'always' | 'overflow'

/**
 * DataGrid 单元格的静态或动态可编辑配置。
 *
 * - `boolean`：所有业务行共用固定的可编辑状态。
 * - `(context) => boolean`：根据当前行、字段和值动态判断是否可编辑。
 */
export type DataGridEditable<Row> = boolean | ((context: DataGridEditorContext<Row>) => boolean)

/**
 * DataGrid 单元格不可编辑时展示的静态或动态原因。
 *
 * - `string`：所有不可编辑单元格共用固定说明。
 * - `(context) => string | undefined`：根据当前单元格动态返回说明；返回 `undefined` 时不展示原因。
 */
export type DataGridReadonlyReason<Row> =
  | string
  | ((context: DataGridEditorContext<Row>) => string | undefined)

/**
 * DataGrid 编辑器基础组件的属性来源。
 *
 * - `ComponentProps`：所有业务行共用一份静态组件属性。
 * - `(context) => ComponentProps`：根据当前单元格上下文动态生成组件属性。
 */
export type DataGridEditorComponentProps<Row, ComponentProps> =
  | ComponentProps
  | ((context: DataGridEditorContext<Row>) => ComponentProps)

/**
 * DataGrid 编辑器的统一展示方式。
 *
 * - `onDemand`：用户触发编辑后临时显示编辑控件。
 * - `always`：可编辑单元格始终显示编辑控件。
 */
export type DataGridEditorDisplayMode = 'onDemand' | 'always'

/** DataGrid 内置和自定义编辑器共用的基础配置。 */
export interface DataGridEditorBase<Row, ComponentProps> {
  /** 当前列是否允许编辑，或按行动态判断编辑权限。 */
  editable?: DataGridEditable<Row>

  /** 当前单元格不可编辑时展示的说明，支持按行业务状态动态返回。 */
  readonlyReason?: DataGridReadonlyReason<Row>

  /** 透传给当前编辑器基础组件的静态属性，或按当前行动态计算的属性。 */
  componentProps?: DataGridEditorComponentProps<Row, ComponentProps>
}

/**
 * DataGrid 不同内置控件和自定义组件的编辑器配置。
 *
 * - `text`：单行文本编辑器。
 * - `textarea`：多行文本编辑器。
 * - `number`：数值编辑器。
 * - `date`：日期编辑器。
 * - `datetime`：日期时间编辑器。
 * - `select`：单选编辑器。
 * - `multiSelect`：多选编辑器。
 * - `boolean`：布尔开关编辑器。
 * - `custom`：业务方提供的自定义 Vue 编辑器。
 */
export type DataGridEditorConfig<Row> =
  | (DataGridEditorBase<Row, DataGridInputComponentProps> & {
      /** 使用单行文本编辑器。 */
      type: 'text'
    })
  | (DataGridEditorBase<Row, DataGridInputComponentProps> & {
      /** 使用多行文本编辑器。 */
      type: 'textarea'
    })
  | (DataGridEditorBase<Row, DataGridInputNumberComponentProps> & {
      /** 使用数字编辑器。 */
      type: 'number'
    })
  | (DataGridEditorBase<Row, DataGridDatePickerComponentProps> & {
      /**
       * 使用日期类编辑器。
       *
       * - `date`：编辑日期值。
       * - `datetime`：编辑包含时间的日期值。
       */
      type: 'date' | 'datetime'
    })
  | (DataGridEditorBase<Row, DataGridSelectComponentProps> & {
      /**
       * 使用选项编辑器。
       *
       * - `select`：仅允许选择一个选项。
       * - `multiSelect`：允许同时选择多个选项。
       */
      type: 'select' | 'multiSelect'
    })
  | (DataGridEditorBase<Row, DataGridSwitchComponentProps> & {
      /** 使用布尔开关编辑器。 */
      type: 'boolean'
    })
  | (DataGridEditorBase<Row, Record<string, unknown>> & {
      /** 使用业务提供的自定义编辑器组件。 */
      type: 'custom'

      /** 渲染当前单元格时使用的自定义 Vue 组件。 */
      component: Component<DataGridCustomEditorProps<Row>>
    })

/** DataGrid 单个底部汇总单元格支持的展示值。 */
export type DataGridSummaryValue = string | number | readonly (string | number)[]

/** DataGrid 单列底部汇总的计算和格式化配置。 */
export interface DataGridColumnSummary<Row> {
  /**
   * 当前列使用的汇总方法。
   *
   * - `sum`：计算数值总和。
   * - `avg`：计算数值平均值。
   * - `count`：统计参与汇总的行数。
   * - `min`：计算最小值。
   * - `max`：计算最大值。
   * - `custom`：调用 `custom` 函数计算业务汇总结果。
   */
  method: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'custom'

  /** 数值汇总结果保留的小数位数。 */
  precision?: number

  /** 从业务行中提取参与汇总的数值。 */
  valueGetter?: (row: Row) => number

  /** 使用全部目标行计算自定义汇总结果。 */
  custom?: (rows: Row[]) => DataGridSummaryValue

  /** 将最终汇总值转换成展示文本。 */
  formatter?: (value: DataGridSummaryValue, rows: Row[]) => DataGridSummaryValue

  /** 当前汇总单元格追加的业务样式类名。 */
  className?: string
}

/** DataGrid 单列复制粘贴行为配置。 */
export interface DataGridColumnClipboard<Row> {
  /** 当前列是否允许复制，默认允许。 */
  copy?: boolean

  /**
   * 当前列是否允许粘贴。
   *
   * 默认允许且不受 `editor`、`editor.editable` 影响；设为 `false` 时才禁止向当前列粘贴。
   */
  paste?: boolean

  /** 粘贴时是否尝试使用名称、值或别名匹配选项。 */
  matchOption?: boolean

  /** 解析前是否移除剪贴板文本两端空白。 */
  trim?: boolean

  /** 匹配选项文本时是否忽略大小写。 */
  ignoreCase?: boolean

  /** 将当前单元格值转换成复制文本。 */
  formatter?: (value: unknown, row: Row) => string

  /** 将剪贴板文本解析为当前字段的业务值。 */
  parser?: (text: string, row: Row) => unknown

  /** 剪贴板内容为空时写入当前字段的值。 */
  emptyValue?: unknown
}

/**
 * DataGrid 触发校验的业务场景。
 *
 * - `edit`：用户提交单元格编辑时触发。
 * - `paste`：剪贴板内容写入候选行时触发。
 * - `submit`：业务页面主动执行整表或指定范围校验时触发。
 */
export type DataGridValidateTrigger = 'edit' | 'paste' | 'submit'

/**
 * DataGrid 单条字段规则的执行结果。
 *
 * - `true`：当前规则校验通过。
 * - `string`：当前规则校验失败，字符串作为错误提示。
 */
export type DataGridRuleResult = true | string

/** DataGrid 字段规则执行时获得的上下文。 */
export interface DataGridValidationContext<Row> {
  /** 本次校验的触发场景。 */
  trigger: DataGridValidateTrigger

  /** 应用本次修改后的候选行。 */
  row: Row

  /** 修改前的行数据。 */
  previousRow?: Row

  /** 当前字段。 */
  field: DataGridField<Row>

  /** 当前行在原始受控数组中的位置。 */
  dataIndex: number

  /**
   * 当前行按现有 `rowKey` 规则解析出的标识。
   *
   * - `string`：字符串业务标识。
   * - `number`：数字业务标识。
   */
  rowKey: string | number

  /** 本次事务修改的字段。 */
  changedFields: DataGridField<Row>[]

  /** 异步校验过期时使用的取消信号。 */
  signal: AbortSignal
}

/** DataGrid 列字段的统一业务校验规则。 */
export interface DataGridValidationRule<Row> {
  /** 当前字段是否必填。 */
  required?: boolean

  /** 必填校验失败时使用的提示。 */
  message?: string

  /**
   * 当前规则参与的校验场景。
   *
   * 未配置时在 `edit`、`paste` 和 `submit` 三个场景中执行。
   */
  triggers?: DataGridValidateTrigger[]

  /**
   * 执行同步或异步字段业务校验。
   *
   * - 返回 `true`：当前字段规则校验通过。
   * - 返回字符串：校验失败，并将字符串作为错误提示。
   * - 返回 Promise：等待异步校验完成后按上述结果处理。
   */
  validator?: (
    value: unknown,
    row: Row,
    context: DataGridValidationContext<Row>,
  ) => DataGridRuleResult | Promise<DataGridRuleResult>
}

/** DataGrid 行规则返回的字段错误。 */
export interface DataGridRowValidationIssue<Row> {
  /** 错误归属字段。 */
  field: DataGridField<Row>

  /** 错误提示。 */
  message: string
}

/** DataGrid 行规则执行时获得的上下文。 */
export interface DataGridRowValidationContext<Row> {
  /** 本次校验的触发场景。 */
  trigger: DataGridValidateTrigger

  /** 应用本次修改后的候选行。 */
  row: Row

  /** 修改前的行数据。 */
  previousRow?: Row

  /** 当前行在原始受控数组中的位置。 */
  dataIndex: number

  /**
   * 当前行按现有 `rowKey` 规则解析出的标识。
   *
   * - `string`：字符串业务标识。
   * - `number`：数字业务标识。
   */
  rowKey: string | number

  /** 本次事务修改的字段。 */
  changedFields: DataGridField<Row>[]

  /** 异步校验过期时使用的取消信号。 */
  signal: AbortSignal
}

/** DataGrid 跨字段或整行业务规则。 */
export interface DataGridRowRule<Row> {
  /**
   * 当前规则参与的校验场景。
   *
   * 未配置时在 `edit`、`paste` 和 `submit` 三个场景中执行。
   */
  triggers?: DataGridValidateTrigger[]

  /**
   * 执行同步或异步行级校验。
   *
   * - 返回 `true`：当前行业务规则校验通过。
   * - 返回单个错误：当前行存在一个字段错误。
   * - 返回错误数组：当前行同时存在多个字段错误。
   * - 返回 Promise：等待异步校验完成后按上述结果处理。
   */
  validator: (
    row: Row,
    context: DataGridRowValidationContext<Row>,
  ) =>
    | true
    | DataGridRowValidationIssue<Row>
    | DataGridRowValidationIssue<Row>[]
    | Promise<true | DataGridRowValidationIssue<Row> | DataGridRowValidationIssue<Row>[]>
}

/** DataGrid 选项值写入业务行时需要同步更新的标签字段。 */
export interface DataGridOptionMapping<Row> {
  /** 保存当前选项展示名称的业务字段。 */
  labelField: DataGridField<Row>
}

/** DataGrid 单元格合并规则执行时获得的业务上下文。 */
export interface DataGridCellMergeContext<Row> {
  /** 当前业务行。 */
  row: Row

  /** 当前行在原始受控数组中的位置。 */
  dataIndex: number

  /** 当前行在排序和筛选后的视图位置。 */
  displayIndex: number

  /** 当前合并起始列的业务字段。 */
  field: DataGridField<Row>

  /** 当前合并起始单元格的原始值。 */
  value: unknown
}

/** DataGrid 连续行合并配置。 */
export interface DataGridRowMergeConfig<Row> {
  /** 判断相邻行是否属于同一合并区域的组合字段，默认只比较当前列字段。 */
  by?: DataGridField<Row>[]

  /** 自定义相邻行业务比较函数，未提供时逐项使用 Object.is。 */
  equals?: (current: Row, previous: Row) => boolean
}

/** DataGrid 同一行内的连续列合并配置。 */
export interface DataGridColumnMergeConfig<Row> {
  /** 合并区域包含的连续业务字段，第一项必须是当前列字段。 */
  fields: DataGridField<Row>[]

  /** 判断当前业务行是否启用该列合并区域。 */
  when?: (context: DataGridCellMergeContext<Row>) => boolean
}

/**
 * DataGrid 业务列内容的水平对齐方式。
 *
 * - `left`：左对齐。
 * - `center`：居中对齐。
 * - `right`：右对齐。
 */
export type DataGridColumnAlign = 'left' | 'center' | 'right'

/**
 * DataGrid 业务单元格内容的垂直对齐方式。
 *
 * - `top`：顶部对齐。
 * - `center`：垂直居中。
 * - `bottom`：底部对齐。
 */
export type DataGridVerticalAlign = 'top' | 'center' | 'bottom'

/** DataGrid 单个业务列的展示、编辑和交互配置。 */
export interface DataGridColumnBase<Row = DataGridRow> {
  /** 当前列对应的业务字段。 */
  field: DataGridField<Row>

  /** 当前列在表头展示的标题。 */
  title: string

  /** 当前列单元格内容的水平对齐方式，默认居中。 */
  align?: DataGridColumnAlign

  /** 当前业务列内容的垂直对齐方式，未配置时继承表格的 rowVerticalAlign。 */
  verticalAlign?: DataGridVerticalAlign

  /** 当前列表头的水平对齐方式，未配置时跟随单元格对齐方式。 */
  headerAlign?: DataGridColumnAlign

  /** 当前列的初始宽度，单位为 px。 */
  width?: number

  /** 当前列允许收缩到的最小宽度，单位为 px。 */
  minWidth?: number

  /** 当前列允许扩展到的最大宽度，单位为 px。 */
  maxWidth?: number

  /** 当前列参与剩余宽度分配的弹性权重。 */
  flex?: number

  /**
   * 当前列固定在表格中的位置。
   *
   * - `left`：固定在表格左侧。
   * - `right`：固定在表格右侧。
   */
  fixed?: 'left' | 'right'

  /** 当前列首次建立时是否可见，默认可见；用户后续仍可通过列设置调整。 */
  initialVisible?: boolean

  /** 当前列是否允许用户排序，默认允许。 */
  sortable?: boolean

  /**
   * 当前列使用的编辑器配置。
   *
   * - `false`：当前列始终不进入编辑状态。
   * - 配置对象：按照指定编辑器类型、可编辑条件和组件属性处理编辑。
   *
   * 编辑器配置只控制界面编辑；在表格编辑模式下，剪贴板粘贴默认仍可写入当前字段。
   * 如需禁止粘贴，应显式配置 `clipboard: false` 或 `clipboard.paste: false`。
   */
  editor?: false | DataGridEditorConfig<Row>

  /** 当前列选择器、格式化和粘贴匹配共用的选项来源。 */
  options?: DataGridOptionsSource

  /** 当前列选项是否正在异步加载。 */
  optionsLoading?: DataGridReactiveValue<boolean>

  /** 选中选项后需要同步写入标签字段的映射配置。 */
  optionMapping?: DataGridOptionMapping<Row>

  /**
   * 当前列的复制粘贴配置。
   *
   * - `false`：同时禁止当前列复制和粘贴。
   * - 配置对象：覆盖当前列的复制、解析和选项匹配策略。
   */
  clipboard?: false | DataGridColumnClipboard<Row>

  /**
   * 当前列依次执行的业务校验规则。
   *
   * 每条规则可分别限制触发场景；同一字段配置多条规则时按照数组顺序执行并收集错误。
   */
  rules?: DataGridValidationRule<Row>[]

  /** 将当前字段原始值转换成单元格展示文本。 */
  formatter?: (value: unknown, row: Row, displayIndex: number) => string

  /** 普通内容 Tooltip 的展示方式；`true` 等价于 `always`，`false` 表示关闭，默认 `overflow`。 */
  tooltip?: boolean | DataGridTooltipMode

  /** 根据当前行和最终格式化文本生成业务 Tooltip；返回空值时不展示业务提示。 */
  tooltipGetter?: (context: DataGridTooltipContext<Row>) => string | undefined

  /**
   * 当前列的底部汇总配置。
   *
   * - 未设置：数值列在表格开启汇总时默认按求和参与汇总，非数值列不参与。
   * - `false`：即使当前列是数值列，也默认不参与底部汇总。
   * - 配置对象：按照指定方法计算并格式化汇总值。
   */
  summary?: false | DataGridColumnSummary<Row>

  /**
   * 当前单元格使用的样式类名。
   *
   * - `string`：所有业务行使用同一个静态类名。
   * - `(row) => string`：根据当前业务行动态返回类名。
   */
  className?: string | ((row: Row) => string)

  /** 当前列是否允许用户在列配置中调整。 */
  configurable?: boolean

  /** 当前列是否允许用户在列配置中隐藏。 */
  hideable?: boolean

  /**
   * 当前列的纵向连续行合并方式。
   *
   * - `true`：按当前列字段值合并相邻行。
   * - `false`：关闭当前列行合并。
   * - 配置对象：按多个字段或自定义比较函数判断相邻行是否合并。
   */
  rowMerge?: boolean | DataGridRowMergeConfig<Row>

  /** 将当前单元格横向覆盖到配置中的连续业务列。 */
  columnMerge?: DataGridColumnMergeConfig<Row>
}

/** DataGrid 完整业务列配置，组合列基础能力与表头搜索配置。 */
export type DataGridColumn<Row = DataGridRow> = DataGridColumnBase<Row> & DataGridSearchConfig

/** DataGrid 底部汇总行的全局展示配置。 */
export interface DataGridSummaryConfig {
  /** 汇总行首个可展示单元格使用的说明文字。 */
  label?: string

  /**
   * 参与汇总的数据范围。
   *
   * - `filtered`：仅汇总当前筛选后可见的业务行。
   * - `all`：汇总全部原始业务行。
   */
  scope?: 'filtered' | 'all'
}

/** DataGrid 表级复制粘贴配置。 */
export interface DataGridClipboardConfig<Row = DataGridRow> {
  /**
   * 是否开启复制能力。
   *
   * 默认开启；列级 `clipboard.copy` 可以进一步关闭指定列复制。
   */
  copy?: boolean

  /**
   * 是否开启粘贴能力。
   *
   * 默认开启；仅在编辑模式且表格未禁用、未加载时生效。
   */
  paste?: boolean

  /**
   * 复制选区时是否在首行包含列标题。
   *
   * 默认不包含；调用 `copySelection` 时可通过方法参数覆盖本次行为。
   */
  copyHeaders?: boolean

  /**
   * 粘贴单个值时是否填充当前完整选区。
   *
   * 默认启用；关闭后单值仅写入选区起始单元格。
   */
  repeatToSelection?: boolean

  /**
   * 剪贴板纯文本为空时的处理方式。
   *
   * - `ignore`：忽略本次空文本粘贴，不修改数据。
   * - `clearCells`：清空当前选区内允许粘贴的单元格。
   *
   * 默认使用 `ignore`。
   */
  emptyTextAction?: 'ignore' | 'clearCells'

  /**
   * 粘贴数据校验失败后的事务处理方式。
   *
   * 未配置时，字段错误和行级错误均采用 `abort`，保证整次粘贴事务原子提交。
   */
  errorHandling?: DataGridClipboardErrorHandlingConfig

  /**
   * 粘贴内容超出当前可用行数时的处理策略。
   *
   * - `auto`：兼容旧配置，行为与 `append` 相同。
   * - `append`：创建并追加缺少的业务行，为默认策略。
   * - `reject`：拒绝整次超出范围的粘贴事务。
   * - `truncate`：仅写入现有行，忽略超出范围的内容。
   */
  overflow?: 'auto' | 'append' | 'reject' | 'truncate'

  /**
   * 粘贴追加业务行时提供业务初始值。
   *
   * 未配置时 DataGrid 创建空对象，并为其自动生成内部临时行标识；
   * 返回值不需要包含业务主键，只需设置新增行必需的默认字段。
   */
  createRow?: (context: DataGridCreateRowContext<Row>) => Partial<Row>
}

/** DataGrid 复制当前选区时使用的行为选项。 */
export interface DataGridCopySelectionOptions {
  /** 是否在复制内容首行加入当前选区的显示列标题；不传时使用表级 copyHeaders 配置。 */
  includeHeaders?: boolean
}

/**
 * DataGrid 粘贴字段错误的事务处理方式。
 *
 * - `abort`：中止整次粘贴事务，不提交任何候选修改。
 * - `skipCell`：跳过当前错误单元格，继续处理其他单元格。
 * - `skipRow`：跳过当前错误所在整行，继续处理其他行。
 */
export type DataGridClipboardCellErrorMode = 'abort' | 'skipCell' | 'skipRow'

/**
 * DataGrid 粘贴行级错误的事务处理方式。
 *
 * - `abort`：中止整次粘贴事务，不提交任何候选修改。
 * - `skipRow`：跳过当前错误所在整行，继续处理其他行。
 */
export type DataGridClipboardRowErrorMode = 'abort' | 'skipRow'

/** DataGrid 粘贴校验错误的事务处理策略。 */
export interface DataGridClipboardErrorHandlingConfig {
  /** 字段解析或列规则失败时的处理方式，默认中止整次粘贴。 */
  cellErrorMode?: DataGridClipboardCellErrorMode

  /** 行规则或无法定位到修改字段的错误处理方式，默认中止整次粘贴。 */
  rowErrorMode?: DataGridClipboardRowErrorMode
}

/** DataGrid 校验引擎配置。 */
export interface DataGridValidationConfig {
  /**
   * 同时执行的异步校验任务数量。
   *
   * 默认值为 6；小于 1 的值会在运行时修正为 1。
   */
  concurrency?: number

  /** 提交校验失败时是否定位第一个可见错误，默认启用。 */
  scrollToFirstError?: boolean

  /** 是否在 DataGrid 工具栏中展示内置校验中心，默认启用。 */
  center?: boolean
}

/** DataGrid 粘贴时创建新业务行所需的上下文。 */
export interface DataGridCreateRowContext<Row = DataGridRow> {
  /** 新业务行写入完整受控数组后的目标位置。 */
  dataIndex: number

  /** 新业务行在本次追加数据中的顺序索引。 */
  appendIndex: number

  /** 可供新行业务默认值参考的现有来源行。 */
  sourceRow?: Row
}

/** DataGrid 撤销和重做历史记录配置。 */
export interface DataGridHistoryConfig {
  /**
   * 历史记录允许保留的最大事务数量。
   *
   * 默认保留 20 条；超过容量时优先移除最早的事务。
   */
  limit?: number

  /**
   * 用户改变排序时是否清空历史记录。
   *
   * 默认清空，避免撤销操作在新的视图顺序下定位到错误行。
   */
  clearOnSort?: boolean

  /**
   * 用户改变筛选条件时是否清空历史记录。
   *
   * 默认清空，避免撤销操作在新的可见行集合中产生歧义。
   */
  clearOnFilter?: boolean
}

/** DataGrid 判断单行是否允许拖动时提供的上下文。 */
export interface DataGridRowDragContext<Row = DataGridRow> {
  /** 当前准备拖动的行数据。 */
  row: Row

  /** 当前行在原始受控数组中的位置。 */
  dataIndex: number
}

/** DataGrid 行拖动功能配置。 */
export interface DataGridRowDragConfig<Row = DataGridRow> {
  /** 拖动手柄列宽，最小为 36px，默认 44px。 */
  handleWidth?: number

  /**
   * 拖动手柄列的固定位置。
   *
   * - `left`：固定在表格左侧。
   * - `right`：固定在表格右侧。
   *
   * 默认使用 `left`。
   */
  fixed?: 'left' | 'right'

  /**
   * 判断指定行当前是否允许拖动。
   *
   * 未配置时所有业务行均允许拖动。
   */
  canDrag?: (context: DataGridRowDragContext<Row>) => boolean

  /**
   * 返回拖动过程中展示的提示文字。
   *
   * 未配置时使用当前行的默认拖动提示。
   */
  dragText?: (context: DataGridRowDragContext<Row>) => string
}

/** DataGrid 行拖动完成后的顺序变化信息。 */
export interface DataGridRowOrderChange<Row = DataGridRow> {
  /** 本次被拖动的行数据。 */
  row: Row

  /**
   * 本次被拖动行的稳定唯一标识。
   *
   * - `string`：字符串业务标识。
   * - `number`：数字业务标识。
   */
  rowKey: string | number

  /** 被拖动行在拖动前受控数组中的位置。 */
  oldDataIndex: number

  /** 被拖动行在拖动后受控数组中的位置。 */
  newDataIndex: number

  /** 拖动完成后的完整行数据。 */
  rows: Row[]
}

/** DataGrid 判断单行是否允许选择时提供的上下文。 */
export interface DataGridRowSelectableContext<Row = DataGridRow> {
  /** 当前准备选择的行数据。 */
  row: Row

  /** 当前行在原始受控数组中的位置。 */
  dataIndex: number

  /** 当前行解析出的稳定唯一标识。 */
  rowKey: DataGridRowKey
}

/** DataGrid 单选和多选共用的行选择配置。 */
export interface DataGridBaseRowSelectionConfig<Row = DataGridRow> {
  /** 是否展示原生选择复选框，默认展示。 */
  showCheckbox?: boolean

  /** 是否允许点击整行切换选择，默认关闭。 */
  selectOnRowClick?: boolean

  /** 数据整页替换后是否保留当前数据中不存在的业务行标识，默认关闭。 */
  reserveSelection?: boolean

  /** 判断指定行当前是否允许选择。 */
  selectable?: (context: DataGridRowSelectableContext<Row>) => boolean
}

/** DataGrid 单行选择配置。 */
export interface DataGridSingleRowSelectionConfig<
  Row = DataGridRow,
> extends DataGridBaseRowSelectionConfig<Row> {
  /** 启用最多选择一行的单选模式。 */
  mode: 'single'
}

/** DataGrid 多行选择配置。 */
export interface DataGridMultipleRowSelectionConfig<
  Row = DataGridRow,
> extends DataGridBaseRowSelectionConfig<Row> {
  /** 启用可同时选择多行的多选模式。 */
  mode: 'multiple'

  /** 是否展示表头全选复选框，默认展示。 */
  headerSelectAll?: boolean

  /**
   * 表头全选操作的数据范围。
   *
   * - `all`：选择全部原始业务行。
   * - `filtered`：仅选择当前筛选后可见的业务行。
   *
   * 默认使用 `filtered`。
   */
  selectAll?: 'all' | 'filtered'
}

/**
 * DataGrid 支持的行选择配置。
 *
 * - `DataGridSingleRowSelectionConfig`：最多允许选择一个业务行。
 * - `DataGridMultipleRowSelectionConfig`：允许选择多个业务行，并支持表头全选。
 */
export type DataGridRowSelectionConfig<Row = DataGridRow> =
  | DataGridSingleRowSelectionConfig<Row>
  | DataGridMultipleRowSelectionConfig<Row>

/**
 * DataGrid 行选择变化的动作。
 *
 * - `select`：新增一个或多个选中行。
 * - `deselect`：取消一个或多个已选行。
 * - `clear`：主动清空全部选择状态。
 * - `prune`：数据或配置变化后自动移除失效的已选行。
 */
export type DataGridRowSelectionAction = 'select' | 'deselect' | 'clear' | 'prune'

/**
 * DataGrid 行选择变化的来源。
 *
 * - `control`：外部 `selectedRowKeys` 受控值发生变化。
 * - `row`：用户通过行或复选框改变选择。
 * - `keyboard`：用户通过键盘改变选择。
 * - `select-all`：用户或公开方法执行全选。
 * - `api`：业务代码调用行选择公开方法。
 * - `data-change`：业务行数据变化后同步选择状态。
 * - `config-change`：行选择配置变化后同步选择状态。
 */
export type DataGridRowSelectionSource =
  | 'control'
  | 'row'
  | 'keyboard'
  | 'select-all'
  | 'api'
  | 'data-change'
  | 'config-change'

/** DataGrid 行选择变化后对业务页面提供的完整快照。 */
export interface DataGridRowSelectionChange<Row = DataGridRow> {
  /** 变化后的完整已选行标识。 */
  selectedRowKeys: DataGridRowKey[]

  /** 当前已加载数据中与已选标识匹配的行数据。 */
  selectedRows: Row[]

  /** 本次选择变化执行的动作。 */
  action: DataGridRowSelectionAction

  /** 本次选择变化的来源。 */
  source: DataGridRowSelectionSource
}

/** DataGrid 用户级列配置的启用参数。 */
export interface DataGridColumnSettingConfig {
  /** 当前表格配置在同一用户下的唯一缓存标识。 */
  key: string

  /** 当前缓存标识对应的业务表格说明，用于集中维护和排查。 */
  description: string

  /** 业务主动废弃旧配置时递增的修订号。 */
  revision?: number

  /** 表格至少需要保留的可见列数量。 */
  minVisibleCount?: number
}

/**
 * DataGrid 列允许持久化的固定位置。
 *
 * - `left`：固定在表格左侧。
 * - `right`：固定在表格右侧。
 * - `null`：不固定，跟随普通业务列滚动。
 */
export type DataGridColumnFixed = 'left' | 'right' | null

/** DataGrid 单列的可持久化状态。 */
export interface DataGridColumnSettingState {
  /** 列字段标识。 */
  field: DataGridField<DataGridRow>

  /** 当前列是否隐藏。 */
  hide: boolean

  /** 当前列的实际像素宽度。 */
  width: number

  /**
   * 当前列的弹性宽度权重。
   *
   * - `number`：按照给定权重参与剩余宽度分配。
   * - `null`：不使用弹性宽度，采用固定像素宽度。
   */
  flex?: number | null

  /** 当前列的固定位置。 */
  fixed: DataGridColumnFixed

  /** 当前数字列是否在底部展示合计。 */
  summary?: boolean
}

/** DataGrid 单列由用户主动修改后需要持久化的覆盖配置。 */
export interface DataGridColumnSettingOverride {
  /** 列字段标识。 */
  field: DataGridField<DataGridRow>

  /** 用户主动修改后的显隐状态；未提供时跟随代码默认配置。 */
  hide?: boolean

  /** 用户主动调整后的像素宽度；未提供时跟随代码默认配置。 */
  width?: number

  /**
   * 用户调整列宽后需要恢复的弹性宽度状态。
   *
   * - `number`：按照给定权重参与剩余宽度分配。
   * - `null`：不使用弹性宽度，采用用户调整后的固定像素宽度。
   */
  flex?: number | null

  /** 用户主动修改后的固定位置；未提供时跟随代码默认配置。 */
  fixed?: DataGridColumnFixed

  /** 用户主动修改后的合计状态；未提供时跟随代码默认配置。 */
  summary?: boolean
}

/** DataGrid 当前表格由用户主动修改后需要持久化的全部覆盖配置。 */
export interface DataGridColumnSettingOverrides {
  /** 用户主动调整后的列字段顺序；未提供时跟随代码声明顺序。 */
  order?: DataGridField<DataGridRow>[]

  /** 按列保存的用户覆盖配置；未修改的配置项不会写入。 */
  columns: DataGridColumnSettingOverride[]
}

/** 表格配置弹窗中使用的单列视图状态。 */
export interface DataGridColumnSettingItem extends DataGridColumnSettingState {
  /** 列标题。 */
  title: string

  /** 当前列用于判断用户修改状态的代码默认值。 */
  defaultState: DataGridColumnSettingState

  /** 当前列在代码声明中的默认顺序索引。 */
  defaultIndex: number

  /** 当前列是否显示。 */
  visible: boolean

  /** 当前列是否允许用户配置。 */
  configurable: boolean

  /** 当前列是否允许用户隐藏。 */
  hideable: boolean

  /** 当前列是否允许展示合计。 */
  summarizable: boolean
}

/** DataGrid 列配置变化事件载荷。 */
export interface DataGridColumnSettingChange {
  /**
   * 本次列配置变化的来源。
   *
   * - `save`：用户在列配置弹窗中确认保存。
   * - `grid`：用户直接通过表头改变列顺序、宽度、固定位置或显隐状态。
   * - `reset`：用户或业务代码恢复默认列配置。
   */
  source: 'save' | 'grid' | 'reset'

  /** 变化后当前表格全部列的状态。 */
  columns: DataGridColumnSettingState[]
}

/**
 * DataGrid 数据变化事务的来源。
 *
 * - `edit`：单元格编辑提交。
 * - `paste`：剪贴板粘贴提交。
 * - `drag`：行拖动排序提交。
 * - `copy`：复制行提交。
 * - `remove`：删除选中行提交。
 * - `undo`：撤销历史事务。
 * - `redo`：重做历史事务。
 */
export type DataGridChangeSource = 'edit' | 'paste' | 'drag' | 'copy' | 'remove' | 'undo' | 'redo'

/** DataGrid 处理单行业务变更时提供的事务上下文。 */
export interface DataGridRowChangeContext<Row = DataGridRow> {
  /** 产生本次行变更的数据操作来源。 */
  source: DataGridChangeSource

  /** 当前业务行在原始受控数组中的位置。 */
  dataIndex: number

  /** 本次事务直接修改的字段集合。 */
  changedFields: DataGridField<Row>[]

  /** 应用本次事务前的完整业务行。 */
  previousRow: Row
}

/** DataGrid 单个字段值变化的完整记录。 */
export interface DataGridValueChange<Row = DataGridRow> {
  /**
   * 当前业务行的稳定唯一标识。
   *
   * - `string`：字符串业务标识。
   * - `number`：数字业务标识。
   */
  rowKey: string | number

  /** 当前业务行在原始受控数组中的位置。 */
  dataIndex: number

  /** 本次发生值变化的业务字段。 */
  field: DataGridField<Row>

  /** 应用本次事务前的字段值。 */
  oldValue: unknown

  /** 应用本次事务后的字段值。 */
  newValue: unknown

  /** 应用本次事务后的完整业务行。 */
  row: Row
}

/** DataGrid 单次数据事务提交后的完整变化信息。 */
export interface DataGridDataChange<Row = DataGridRow> {
  /** 产生本次事务的数据操作来源。 */
  source: DataGridChangeSource

  /** 本次事务提交后的完整行数据。 */
  rows: Row[]

  /** 本次事务包含的字段值变化。 */
  changes: DataGridValueChange<Row>[]

  /** 本次粘贴事务自动追加的行。 */
  appendedRows?: Row[]

  /** 本次撤销事务移除的自动追加行或复制副本。 */
  removedRows?: Row[]

  /** 本次复制行或重做事务插入的业务行。 */
  insertedRows?: Row[]

  /** 本次行拖动产生的顺序变化。 */
  rowOrderChange?: DataGridRowOrderChange<Row>
}

/**
 * DataGrid 复制行时支持的新增位置。
 *
 * - `insert`：将副本插入到来源行之后。
 * - `append`：将副本追加到完整业务数组末尾。
 */
export type DataGridRowCopyMode = 'insert' | 'append'

/** DataGrid 复制行功能配置。 */
export interface DataGridRowCopyConfig<Row = DataGridRow> {
  /** 每次打开弹窗时默认填写的额外新增行数，默认 1。 */
  defaultCount?: number

  /** 允许填写的最小额外新增行数，默认 1。 */
  min?: number

  /** 允许填写的最大额外新增行数，默认 99。 */
  max?: number

  /**
   * 每次打开弹窗时默认选中的新增位置。
   *
   * - `insert`：将副本插入来源行之后。
   * - `append`：将副本追加到完整数组末尾。
   *
   * 默认使用 `insert`。
   */
  defaultMode?: DataGridRowCopyMode

  /**
   * 在复制行事务提交前转换全部新增副本。
   *
   * 回调应返回与入参数量相同、对象引用互不重复的新数组；
   * DataGrid 会在转换完成后为缺少业务行标识的副本生成私有临时 rowKey。
   */
  processInsertedRows?: (rows: Row[]) => Row[]
}

/** DataGrid 完成一次复制行后的变化信息。 */
export interface DataGridRowCopyChange<Row = DataGridRow> {
  /** 本次作为复制来源的完整业务行。 */
  sourceRow: Row

  /** 源行在复制前受控数组中的位置。 */
  sourceDataIndex: number

  /** 源行的稳定唯一标识。 */
  sourceRowKey: DataGridRowKey

  /** 本次额外新增的行数。 */
  count: number

  /** 本次采用的新增位置。 */
  mode: DataGridRowCopyMode

  /** 新增行在复制后受控数组中的起始位置。 */
  insertDataIndex: number

  /** 本次生成的全部副本。 */
  insertedRows: Row[]

  /** 复制完成后的完整行数据。 */
  rows: Row[]
}

/** DataGrid 矩形选区中的单个单元格坐标。 */
export interface DataGridCellPosition<Row = DataGridRow> {
  /** 当前单元格在排序和筛选后的视图位置。 */
  displayIndex: number

  /** 当前单元格对应的业务字段。 */
  field: DataGridField<Row>
}

/** DataGrid 矩形单元格选区的起止坐标。 */
export interface DataGridSelectionRange<Row = DataGridRow> {
  /** 当前矩形选区左上角的起始坐标。 */
  start: DataGridCellPosition<Row>

  /** 当前矩形选区右下角的结束坐标。 */
  end: DataGridCellPosition<Row>
}

/** DataGrid 单个剪贴板解析、校验或写入错误。 */
export interface DataGridClipboardError<Row = DataGridRow> {
  /** 错误单元格在排序和筛选后的视图位置。 */
  displayIndex: number

  /** 错误单元格对应的业务字段；空字符串表示错误不属于具体列。 */
  field: DataGridField<Row> | ''

  /** 错误单元格对应的显示列标题。 */
  columnTitle?: string

  /** 产生错误的原始剪贴板文本。 */
  text: string

  /** 面向用户展示的错误原因。 */
  message: string

  /** 错误发生时对应的候选业务行。 */
  row?: Row
}

/** DataGrid 完成一次复制后对外提供的载荷。 */
export interface DataGridClipboardCopyPayload<Row = DataGridRow> {
  /** 本次复制生成的纯文本。 */
  text: string

  /** 本次复制覆盖的单元格矩形范围。 */
  range?: DataGridSelectionRange<Row>
}

/** DataGrid 完成一次粘贴事务后对外提供的载荷。 */
export interface DataGridClipboardPastePayload<Row = DataGridRow> {
  /** 本次粘贴接收的原始文本。 */
  text: string

  /** 本次粘贴覆盖的单元格矩形范围。 */
  range?: DataGridSelectionRange<Row>

  /** 本次粘贴实际修改的单元格数量。 */
  changedCount: number

  /** 本次粘贴因禁用策略、合并区域或数据错误跳过的单元格和整行总数。 */
  skippedCount: number

  /** 本次粘贴产生的全部字段值变化。 */
  changes: DataGridValueChange<Row>[]

  /** 本次粘贴产生的全部解析或校验错误。 */
  errors: DataGridClipboardError<Row>[]

  /** 本次粘贴自动追加的业务行数量。 */
  appendedCount: number

  /** 本次粘贴自动追加的完整业务行。 */
  appendedRows: Row[]

  /** 本次粘贴因列级禁用、合并区域或字段错误跳过的单元格数量。 */
  skippedCellCount: number

  /** 本次粘贴跳过的整行数量。 */
  skippedRowCount: number
}

/** DataGrid 单个校验错误。 */
export interface DataGridValidationError<Row = DataGridRow> {
  /**
   * 当前行按现有 `rowKey` 规则解析出的标识。
   *
   * - `string`：字符串业务标识。
   * - `number`：数字业务标识。
   */
  rowKey: string | number

  /** 当前行在原始受控数组中的位置。 */
  dataIndex: number

  /** 错误归属字段。 */
  field: DataGridField<Row>

  /** 错误列标题。 */
  columnTitle: string

  /** 产生错误的当前值。 */
  value: unknown

  /** 错误提示。 */
  message: string

  /** 当前完整行数据。 */
  row: Row

  /** 触发校验的业务场景。 */
  trigger: DataGridValidateTrigger

  /**
   * 当前错误的规则来源。
   *
   * - `column`：来自当前字段配置的列校验规则。
   * - `row`：来自跨字段或整行业务规则。
   */
  source: 'column' | 'row'
}

/** DataGrid 一次校验的完整结果。 */
export interface DataGridValidationResult<Row = DataGridRow> {
  /** 本次校验是否全部通过。 */
  valid: boolean

  /** 本次校验产生的全部错误。 */
  errors: DataGridValidationError<Row>[]
}

/** DataGrid 校验状态变化事件载荷。 */
export interface DataGridValidationState<Row = DataGridRow> extends DataGridValidationResult<Row> {
  /** 当前是否仍有异步校验正在执行。 */
  validating: boolean
}

/** DataGrid 整表校验方法的执行选项。 */
export interface DataGridValidateOptions {
  /** 校验失败时是否定位第一个可见错误。 */
  scrollToFirstError?: boolean
}

/** DataGrid 清理校验状态的目标范围。 */
export interface DataGridClearValidateOptions<Row = DataGridRow> {
  /** 仅清理指定行；不传时匹配全部行。 */
  row?: Row

  /** 仅清理指定字段；不传时匹配全部字段。 */
  field?: DataGridField<Row>
}

/** DataGrid 将剪贴板文本转换成业务字段值的解析函数。 */
export type DataGridClipboardParser<Row = DataGridRow> = (text: string, row: Row) => unknown

/** DataGrid 日期剪贴板解析器配置。 */
export interface DataGridDateParserConfig {
  /** 是否允许将 Excel 日期序列号转换成日期。 */
  allowExcelSerial?: boolean

  /**
   * 剪贴板文本为空时返回的业务值。
   *
   * - `null`：将空文本转换为空值。
   * - `string`：将空文本转换成指定字符串。
   */
  emptyValue?: null | string
}

/** DataGrid 数值剪贴板解析器配置。 */
export interface DataGridNumberParserConfig {
  /** 解析后的数值保留的小数位数。 */
  precision?: number

  /** 是否允许解析带有货币符号的文本。 */
  allowCurrencySymbol?: boolean

  /** 是否允许将会计格式括号识别为负数。 */
  allowAccountingNegative?: boolean

  /** 是否允许解析科学计数法文本。 */
  allowScientific?: boolean
}

/** DataGrid 百分比剪贴板解析器配置。 */
export interface DataGridPercentageParserConfig {
  /**
   * 百分比解析结果的存储形式。
   *
   * - `percent`：按百分数存储，例如 `13%` 保存为 `13`。
   * - `decimal`：按小数存储，例如 `13%` 保存为 `0.13`。
   */
  storage: 'percent' | 'decimal'

  /** 解析后的百分比数值保留的小数位数。 */
  precision?: number
}

/** DataGrid 撤销和重做功能的当前状态。 */
export interface DataGridHistoryState {
  /** 当前可撤销的历史事务数量。 */
  undoSize: number

  /** 当前可重做的历史事务数量。 */
  redoSize: number

  /** 当前是否存在可执行的撤销事务。 */
  canUndo: boolean

  /** 当前是否存在可执行的重做事务。 */
  canRedo: boolean
}

/** DataGrid 拖拽调整高度配置。 */
export interface DataGridHeightResizeConfig {
  /** 表格允许调整到的最小高度，单位为 px，默认 160。 */
  min?: number

  /** 表格允许调整到的最大高度，单位为 px，默认 1200。 */
  max?: number
}

/**
 * DataGrid 全屏状态变化的触发来源。
 *
 * - `button`：用户点击工具栏全屏按钮。
 * - `keyboard`：用户通过键盘快捷操作进入或退出全屏。
 * - `api`：业务代码调用组件公开方法。
 * - `instance-change`：其他 DataGrid 实例进入全屏，导致当前实例退出。
 */
export type DataGridFullscreenChangeSource = 'button' | 'keyboard' | 'api' | 'instance-change'

/** DataGrid 全屏状态变化后对外提供的信息。 */
export interface DataGridFullscreenChange {
  /** 当前 DataGrid 是否覆盖应用视口。 */
  fullscreen: boolean

  /** 本次全屏状态变化的触发来源。 */
  source: DataGridFullscreenChangeSource
}

/** DataGrid 顶部工具栏插槽可以使用的状态和操作。 */
export interface DataGridToolbarSlotProps {
  /** 当前 DataGrid 是否覆盖应用视口。 */
  fullscreen: boolean

  /** 让当前 DataGrid 覆盖应用视口。 */
  enterFullscreen: () => void

  /** 退出当前 DataGrid 的应用视口全屏状态。 */
  exitFullscreen: () => void

  /** 在普通状态和应用视口全屏状态之间切换。 */
  toggleFullscreen: () => void

  /** 打开当前 DataGrid 的列配置弹窗。 */
  openColumnSetting: () => void
}

/** DataGrid 分页连续序号配置。 */
export interface DataGridRowIndexPagination {
  /** 当前页码，从 1 开始。 */
  current: number

  /** 每页数据条数。 */
  size: number
}

/** DataGrid 对外公开的组件属性。 */
export interface DataGridProps<Row = DataGridRow> {
  /**
   * 表格受控的完整业务行数据，通过 v-model 使用不可变数组更新。
   *
   * 行缺少有效业务 rowKey 时，DataGrid 会通过当前组件实例的 WeakMap 管理私有临时身份，不修改业务对象。
   * 运行时收到 `null`、`undefined` 或其他非数组值时会临时按空数组渲染，异步回填数组后自动更新。
   */
  modelValue: Row[]

  /** 表格全部业务列的配置，不允许传入 AG Grid 原生列定义。 */
  columns: DataGridColumn<Row>[]

  /**
   * 开发诊断配置。
   *
   * - `true`：使用默认诊断策略。
   * - `false`：关闭全部开发诊断。
   * - 配置对象：覆盖输出级别、定位名称和上下文策略。
   *
   * 未配置时仅在开发环境输出 `warning` 和 `error`。
   */
  diagnostics?: boolean | DataGridDiagnosticsConfig

  /**
   * 业务行唯一标识的解析方式。
   *
   * - 字段名：读取业务行对应字段作为行标识。
   * - 取值函数：根据完整业务行返回行标识。
   *
   * 未设置时兼容读取 `id`；仍无有效值时使用当前组件实例的私有临时标识。
   * DataGrid 不会为了私有身份创建或写入任何业务字段。
   */
  rowKey?: DataGridRowKeyResolver<Row>

  /**
   * 序号列配置。
   *
   * - `false`：不展示序号列。
   * - `true`：展示从 1 开始的连续序号。
   * - 分页对象：根据当前页码和每页条数生成跨页连续序号。
   */
  rowNumbering?: boolean | DataGridRowIndexPagination

  /**
   * 行选择配置。
   *
   * - `false`：关闭全部行选择能力。
   * - 单选配置：最多保留一个选中行。
   * - 多选配置：允许选择多行，并可配置表头全选范围。
   */
  rowSelection?: false | DataGridRowSelectionConfig<Row>

  /** 当前已选行标识，通过 v-model:selected-row-keys 双向绑定。 */
  selectedRowKeys?: DataGridRowKey[]

  /**
   * 表格当前的交互模式。
   *
   * - `view`：只读查看数据。
   * - `edit`：允许编辑满足列级条件的单元格。
   *
   * 默认使用 `view`。
   */
  mode?: DataGridMode

  /**
   * 编辑控件的整表展示方式。
   *
   * - `always`：可编辑单元格始终展示编辑控件。
   * - `onDemand`：用户触发编辑后临时展示控件。
   *
   * 默认使用 `always`；自定义单元格插槽仍优先采用按需编辑。
   */
  editorDisplayMode?: DataGridEditorDisplayMode

  /** 是否禁用编辑、粘贴、拖动、复制行等全部数据修改交互，优先级高于列级 editor.editable。 */
  disabled?: boolean

  /** 是否展示加载遮罩并限制加载期间的表格交互。 */
  loading?: boolean

  /**
   * 表格整体高度。
   *
   * - `number`：使用对应像素高度。
   * - 普通 `string`：直接使用合法 CSS 高度值。
   * - `flex`：填满纵向 Flex 父容器的剩余空间。
   * - 未设置：根据工具栏、表头、数据行、汇总行及滚动条预留自动计算。
   *
   * 自动高度不会超过 `heightResize.max`，未配置最大值时上限为 1200px。
   */
  height?: number | string | 'flex'

  /**
   * 用户拖拽调整表格高度的配置。
   *
   * - `true`：允许调整，并使用默认最小和最大高度。
   * - `false`：关闭高度调整手柄。
   * - 配置对象：允许调整，并覆盖最小或最大高度。
   */
  heightResize?: boolean | DataGridHeightResizeConfig

  /** 是否在顶部工具栏展示内置全屏入口，默认开启。 */
  showFullscreenButton?: boolean

  /** 表格单行业务数据的显示高度，单位为 px。 */
  rowHeight?: number

  /** 业务数据列内容的默认垂直对齐方式，默认居中。 */
  rowVerticalAlign?: DataGridVerticalAlign

  /** 表格表头的显示高度，单位为 px。 */
  headerHeight?: number

  /**
   * 表格底部汇总行配置。
   *
   * - `false`：不展示汇总行。
   * - `true`：展示汇总行并使用默认说明文字和数据范围。
   * - 配置对象：展示汇总行并指定说明文字和数据范围；未单独配置的数值列默认求和。
   */
  summary?: boolean | DataGridSummaryConfig

  /**
   * 表格复制粘贴配置。
   *
   * - `false`：关闭全部复制粘贴能力。
   * - 配置对象：与内置默认策略合并，仅覆盖传入字段。
   *
   * 未配置时默认开启复制和粘贴。
   */
  clipboard?: false | DataGridClipboardConfig<Row>

  /**
   * 跨字段或整行业务校验规则。
   *
   * 多条规则按照数组顺序执行；每条规则可独立限制 `edit`、`paste` 和 `submit` 触发场景。
   */
  rowRules?: DataGridRowRule<Row>[]

  /**
   * 业务校验引擎配置。
   *
   * - `false`：关闭列规则和行规则校验。
   * - 配置对象：覆盖并发数、错误定位和校验中心展示策略。
   * - 未设置：检测到列规则或行规则时自动启用校验。
   */
  validation?: false | DataGridValidationConfig

  /**
   * 撤销和重做配置。
   *
   * - `true`：开启历史记录并使用默认策略。
   * - `false`：不记录编辑历史。
   * - 配置对象：开启历史记录并覆盖容量或清理策略。
   *
   * 未配置时默认开启。
   */
  history?: boolean | DataGridHistoryConfig

  /**
   * 行拖动配置。
   *
   * - `true`：开启行拖动并使用默认手柄配置。
   * - `false`：不展示行拖动手柄。
   * - 配置对象：开启行拖动并覆盖手柄位置、可拖动条件或提示文字。
   *
   * 未配置时默认关闭；查看或禁用模式下自动停用。
   */
  rowDrag?: boolean | DataGridRowDragConfig<Row>

  /**
   * 复制行配置。
   *
   * - `true`：开启复制行并使用默认数量范围和新增位置。
   * - `false`：不展示复制行入口。
   * - 配置对象：开启复制行并覆盖数量范围或默认新增位置。
   *
   * 未配置时默认关闭；查看或禁用模式下自动停用。
   */
  rowCopy?: boolean | DataGridRowCopyConfig<Row>

  /**
   * 用户级列配置。
   *
   * - `false`：不展示列配置入口，也不读写本地缓存。
   * - 配置对象：启用列配置，并按稳定缓存标识保存用户设置。
   */
  columnSetting?: false | DataGridColumnSettingConfig

  /** 单行值变化后同步计算派生字段并返回最终业务行，不应直接修改传入行。 */
  processRowChange?: (row: Row, context: DataGridRowChangeContext<Row>) => Row
}

/** DataGrid 单个单元格编辑提交后的变化信息。 */
export interface DataGridCellChange<Row = DataGridRow> {
  /** 编辑提交后的完整业务行。 */
  row: Row

  /** 当前业务行在原始受控数组中的位置。 */
  dataIndex: number

  /** 本次编辑直接修改的业务字段。 */
  field: DataGridField<Row>

  /** 本次编辑提交前的字段值。 */
  oldValue: unknown

  /** 本次编辑提交后的字段值。 */
  newValue: unknown
}

/** DataGrid 自定义单元格插槽获得的字段级渲染上下文。 */
export interface DataGridCellSlot<
  Row = DataGridRow,
  Field extends DataGridField<Row> = DataGridField<Row>,
> {
  /** 当前单元格所属的完整业务行。 */
  row: Row

  /** 当前单元格未经格式化的原始值。 */
  value: Row[Field]

  /** 当前业务行在原始受控数组中的位置。 */
  dataIndex: number

  /** 当前业务行在排序和筛选后的视图位置。 */
  displayIndex: number

  /** 当前单元格对应的完整业务列配置，并将字段收窄到当前动态插槽。 */
  column: DataGridColumn<Row> & {
    /** 当前动态插槽对应的业务字段。 */
    field: Field
  }
}

/** DataGrid 根据业务行字段生成的动态单元格插槽集合。 */
export type DataGridCellSlots<Row = DataGridRow> = {
  [Field in DataGridField<Row> as `cell-${Field}`]?: (
    props: DataGridCellSlot<Row, Field>,
  ) => unknown
}

/** DataGrid 工具栏、状态区域和字段级单元格的完整插槽声明。 */
export type DataGridSlots<Row = DataGridRow> = DataGridCellSlots<Row> & {
  /** 自定义工具栏左侧内容。 */
  'toolbar-left'?: (props: DataGridToolbarSlotProps) => unknown

  /** 自定义工具栏右侧内容。 */
  'toolbar-right'?: (props: DataGridToolbarSlotProps) => unknown

  /** 自定义表格加载状态内容。 */
  loading?: () => unknown

  /** 自定义表格空状态内容。 */
  empty?: () => unknown
}

/** DataGrid 表格实例初始化完成时提供的信息。 */
export interface DataGridGridReadyPayload {
  /** 表格初始化时已加载的业务行数量。 */
  rowCount: number
}

/** DataGrid 全屏控制方法。 */
export interface DataGridFullscreenExpose {
  /** 让当前 DataGrid 覆盖应用视口。 */
  enter(): void

  /** 退出当前 DataGrid 的应用视口全屏状态。 */
  exit(): void

  /** 在普通状态和应用视口全屏状态之间切换。 */
  toggle(): void

  /** 返回当前 DataGrid 是否处于应用视口全屏状态。 */
  isActive(): boolean
}

/** DataGrid 剪贴板控制方法。 */
export interface DataGridClipboardExpose {
  /** 将当前矩形选区写入系统剪贴板。 */
  copySelection(options?: DataGridCopySelectionOptions): Promise<boolean>

  /** 将给定文本按当前剪贴板策略粘贴到选区。 */
  pasteText(text: string): Promise<boolean>
}

/** DataGrid 单元格矩形选区控制方法。 */
export interface DataGridCellSelectionExpose<Row = DataGridRow> {
  /** 清除当前单元格矩形选区。 */
  clear(): void

  /** 返回当前单元格矩形选区，没有选区时返回 undefined。 */
  getRange(): DataGridSelectionRange<Row> | undefined
}

/** DataGrid 行选择控制方法。 */
export interface DataGridRowSelectionExpose<Row = DataGridRow> {
  /** 返回当前完整的已选行标识。 */
  getKeys(): DataGridRowKey[]

  /** 返回当前已加载数据中的已选行。 */
  getRows(): Row[]

  /** 通过行标识设置当前选择，并触发行选择变化事件。 */
  setKeys(keys: DataGridRowKey[]): void

  /** 清除全部已选行。 */
  clear(): void

  /** 按当前多选配置选择全部或过滤后的行。 */
  selectAll(): void

  /**
   * 删除当前已加载数据中的全部选中行并返回被删除的数据。
   * 该操作会更新 v-model、清空选择状态，并在启用 history 时写入撤销记录。
   */
  removeSelected(): Row[]
}

/** DataGrid 编辑历史控制方法。 */
export interface DataGridHistoryExpose {
  /** 撤销最近一次可回退的数据事务。 */
  undo(): boolean

  /** 重做最近一次已撤销的数据事务。 */
  redo(): boolean

  /** 返回当前是否存在可撤销的数据事务。 */
  canUndo(): boolean

  /** 返回当前是否存在可重做的数据事务。 */
  canRedo(): boolean

  /** 清空当前表格保存的撤销和重做历史。 */
  clear(): void
}

/** DataGrid 用户级列配置控制方法。 */
export interface DataGridColumnSettingExpose {
  /** 打开当前表格的用户级列配置弹窗。 */
  open(): void

  /** 清除当前用户缓存并恢复代码声明的默认列配置。 */
  reset(): void
}

/** DataGrid 业务校验控制方法。 */
export interface DataGridValidationExpose<Row = DataGridRow> {
  /** 校验全部原始行并返回完整错误列表。 */
  validate(options?: DataGridValidateOptions): Promise<DataGridValidationResult<Row>>

  /** 校验指定行。 */
  validateRow(row: Row, trigger?: DataGridValidateTrigger): Promise<DataGridValidationResult<Row>>

  /** 校验指定行的单个字段。 */
  validateField(
    row: Row,
    field: DataGridField<Row>,
    trigger?: DataGridValidateTrigger,
  ): Promise<DataGridValidationResult<Row>>

  /** 清理全部或指定范围的校验错误。 */
  clear(options?: DataGridClearValidateOptions<Row>): void

  /** 获取当前组件保存的校验错误。 */
  getErrors(): DataGridValidationError<Row>[]

  /** 返回当前是否仍有异步校验任务。 */
  isValidating(): boolean
}

/** DataGrid 单元格加载状态控制方法。 */
export interface DataGridCellLoadingExpose<Row = DataGridRow> {
  /** 为指定单元格启动一个可并发、可幂等结束的 Loading 任务。 */
  start(
    rowKey: DataGridRowKey,
    field: DataGridField<Row>,
    options?: DataGridCellLoadingOptions,
  ): DataGridCellLoadingTask

  /** 强制清理全部、指定行或指定单元格的 Loading 任务和计时器。 */
  clear(rowKey?: DataGridRowKey, field?: DataGridField<Row>): void

  /** 返回指定单元格当前是否仍存在未完成的 Loading 任务。 */
  isLoading(rowKey: DataGridRowKey, field: DataGridField<Row>): boolean
}

/** DataGrid 通过组件 Ref 对外公开的方法集合。 */
export interface DataGridExpose<Row = DataGridRow> {
  /** 清空全部表头筛选条件。 */
  clearFilters(): void

  /** 将列顺序、宽度、固定位置和显隐状态恢复为代码默认值。 */
  resetColumns(): void

  /** 强制刷新当前表格的单元格和汇总显示。 */
  refresh(): void

  /** 返回当前经过排序和筛选后展示的业务行。 */
  getDisplayedRows(): Row[]

  /** 将指定业务行滚动到表格可视区域。 */
  scrollToRow(rowKey: DataGridRowKey): void

  /** 将指定业务行和业务字段对应的单元格滚动到可视区域。 */
  scrollToCell(rowKey: DataGridRowKey, field: DataGridField<Row>): void

  /** 当前表格的全屏控制方法。 */
  fullscreen: DataGridFullscreenExpose

  /** 当前表格的剪贴板控制方法。 */
  clipboard: DataGridClipboardExpose

  /** 当前表格的单元格矩形选区控制方法。 */
  cellSelection: DataGridCellSelectionExpose<Row>

  /** 当前表格的行选择控制方法。 */
  rowSelection: DataGridRowSelectionExpose<Row>

  /** 当前表格的编辑历史控制方法。 */
  history: DataGridHistoryExpose

  /** 当前表格的用户级列配置控制方法。 */
  columnSetting: DataGridColumnSettingExpose

  /** 当前表格的业务校验控制方法。 */
  validation: DataGridValidationExpose<Row>

  /** 当前表格的单元格加载状态控制方法。 */
  cellLoading: DataGridCellLoadingExpose<Row>
}

/** DataGrid 传递给自定义单元格编辑器组件的 Props。 */
export interface DataGridCustomEditorProps<Row = DataGridRow> {
  /** 自定义编辑器当前维护的字段值。 */
  modelValue: unknown

  /** 当前编辑单元格所属的完整业务行。 */
  row: Row

  /** 当前业务行在原始受控数组中的位置。 */
  dataIndex: number

  /** 当前业务行在排序和筛选后的视图位置。 */
  displayIndex: number

  /** 当前编辑单元格对应的完整业务列配置。 */
  column: DataGridColumn<Row>

  /** 当前自定义编辑器是否应禁止用户修改。 */
  disabled: boolean

  /** 确认当前草稿，并进入 DataGrid 的事务、校验和历史记录链路。 */
  commit: () => void

  /** 撤销当前草稿，并恢复本次编辑前的字段值。 */
  cancel: () => void
}

export function defineDataGridColumns<Row>(columns: DataGridColumn<Row>[]) {
  return columns
}

export function defineDataGridOptions<Value>(
  options: readonly DataGridOption<Value>[],
): readonly DataGridOption<Value>[]
export function defineDataGridOptions<Value>(
  options: Ref<readonly DataGridOption<Value>[]> | ComputedRef<readonly DataGridOption<Value>[]>,
): Ref<readonly DataGridOption<Value>[]> | ComputedRef<readonly DataGridOption<Value>[]>
export function defineDataGridOptions<Value>(options: DataGridOptionsSource<Value>) {
  return options
}
