use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

pub const GRID_SIZE: u32 = 1000;
pub const MAX_PIXELS: u32 = GRID_SIZE * GRID_SIZE;
pub const INITIAL_PRICE: u64 = 1_000_000; // 1 USDC (6 decimals)
pub const FEE_BPS: u64 = 500; // 5%

#[account]
pub struct Canvas {
    pub treasury: Pubkey,
}

#[account]
pub struct PixelAccount {
    pub owner: Pubkey,
    pub price: u64,
    pub for_sale: bool,
}

#[account]
pub struct Profile {
    pub display_name: String,
    pub twitter: String,
    pub website: String,
    pub ca: String,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Treasury wallet (receives USDC)
    pub treasury: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + 32,
        seeds = [b"canvas"],
        bump
    )]
    pub canvas: Account<'info, Canvas>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(pixel_id: u32)]
pub struct Buy<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(seeds = [b"canvas"], bump)]
    pub canvas: Account<'info, Canvas>,

    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + 32 + 8 + 1,
        seeds = [b"pixel", &pixel_id.to_le_bytes()],
        bump
    )]
    pub pixel: Account<'info, PixelAccount>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(mut, constraint = buyer_usdc.owner == buyer.key() @ ErrorCode::InvalidTokenAccount)]
    pub buyer_usdc: Account<'info, TokenAccount>,

    #[account(mut)]
    pub treasury_usdc: Account<'info, TokenAccount>,

    #[account(mut)]
    pub seller_usdc: Option<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(pixel_id: u32)]
pub struct ListPixel<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pixel", &pixel_id.to_le_bytes()],
        bump,
        constraint = pixel.owner == owner.key() @ ErrorCode::Unauthorized
    )]
    pub pixel: Account<'info, PixelAccount>,
}

#[derive(Accounts)]
#[instruction(pixel_id: u32)]
pub struct UnlistPixel<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pixel", &pixel_id.to_le_bytes()],
        bump,
        constraint = pixel.owner == owner.key() @ ErrorCode::Unauthorized
    )]
    pub pixel: Account<'info, PixelAccount>,
}

#[derive(Accounts)]
pub struct SetProfile<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + 4 + 32 + 4 + 64 + 4 + 128 + 4 + 64,
        seeds = [b"profile", owner.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, Profile>,

    pub system_program: Program<'info, System>,
}

#[program]
pub mod agentcanvas {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.canvas.treasury = ctx.accounts.treasury.key();
        Ok(())
    }

    pub fn buy(ctx: Context<Buy>, pixel_id: u32) -> Result<()> {
        require!(pixel_id < MAX_PIXELS, ErrorCode::InvalidPixelId);

        let canvas = &ctx.accounts.canvas;
        let pixel = &mut ctx.accounts.pixel;
        let treasury = canvas.treasury;

        if pixel.owner == Pubkey::default() {
            pixel.owner = ctx.accounts.buyer.key();
            pixel.for_sale = false;
            pixel.price = 0;

            let cpi_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_usdc.to_account_info(),
                    to: ctx.accounts.treasury_usdc.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            );
            token::transfer(cpi_ctx, INITIAL_PRICE)?;
        } else {
            require!(pixel.for_sale, ErrorCode::NotForSale);
            let sale_price = pixel.price;
            let fee = sale_price * FEE_BPS / 10000;
            let to_seller = sale_price - fee;

            let seller = pixel.owner;
            pixel.owner = ctx.accounts.buyer.key();
            pixel.for_sale = false;
            pixel.price = 0;

            if to_seller > 0 {
                let seller_ata = ctx.accounts.seller_usdc.as_ref().ok_or(ErrorCode::MissingSellerAccount)?;
                require!(seller_ata.owner == seller, ErrorCode::InvalidTokenAccount);
                let cpi_ctx = CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.buyer_usdc.to_account_info(),
                        to: seller_ata.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                );
                token::transfer(cpi_ctx, to_seller)?;
            }
            if fee > 0 {
                let cpi_ctx = CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.buyer_usdc.to_account_info(),
                        to: ctx.accounts.treasury_usdc.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                );
                token::transfer(cpi_ctx, fee)?;
            }
        }

        Ok(())
    }

    pub fn list_pixel(ctx: Context<ListPixel>, _pixel_id: u32, price: u64) -> Result<()> {
        require!(price > 0, ErrorCode::InvalidPrice);
        ctx.accounts.pixel.price = price;
        ctx.accounts.pixel.for_sale = true;
        Ok(())
    }

    pub fn unlist_pixel(ctx: Context<UnlistPixel>, _pixel_id: u32) -> Result<()> {
        ctx.accounts.pixel.price = 0;
        ctx.accounts.pixel.for_sale = false;
        Ok(())
    }

    pub fn set_profile(
        ctx: Context<SetProfile>,
        display_name: String,
        twitter: String,
        website: String,
        ca: String,
    ) -> Result<()> {
        let profile = &mut ctx.accounts.profile;
        profile.display_name = display_name;
        profile.twitter = twitter;
        profile.website = website;
        profile.ca = ca;
        Ok(())
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid pixel id")]
    InvalidPixelId,
    #[msg("Pixel not for sale")]
    NotForSale,
    #[msg("Invalid price")]
    InvalidPrice,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid token account")]
    InvalidTokenAccount,
    #[msg("Missing seller USDC account for resale")]
    MissingSellerAccount,
}
