export class PortfolioSummaryDto {
    invested_amount: number;
    current_amount: number;
    net_pnl: number;
    abs_return_percentage: number;
    xirr_percentage: number;
    schemes: SchemeSummaryDto[];
}

export class SchemeSummaryDto {
    scheme_name: string;
    scheme_code: string;
    invested_amount: number;
    current_amount: number;
    net_pnl: number;
    abs_return_percentage: number;
    xirr_percentage: number;
    units_held: number;
    current_nav: number;
    nav_date: Date;
    is_sip?: boolean;
    sip_amount?: number;
}
