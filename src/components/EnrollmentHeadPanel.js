/* eslint-disable max-len */
/* eslint-disable camelcase */
import React from 'react';
import { injectIntl } from 'react-intl';
import { Grid, Divider } from '@material-ui/core';
import { withStyles, withTheme } from '@material-ui/core/styles';
import {
  decodeId,
  FormPanel,
  PublishedComponent,
  formatMessage,
  withModulesManager,
} from '@openimis/fe-core';
import AdvancedCriteriaForm from './dialogs/AdvancedCriteriaForm';
import { CLEARED_STATE_FILTER } from '../constants';

const styles = (theme) => ({
  tableTitle: theme.table.title,
  item: theme.paper.item,
  fullHeight: {
    height: '100%',
  },
});

class EnrollmentHeadPanel extends FormPanel {
  constructor(props) {
    super(props);
    this.state = {
      appliedCustomFilters: [CLEARED_STATE_FILTER],
      appliedFiltersRowStructure: [CLEARED_STATE_FILTER],
    };
  }

  updateJsonExt = (value) => {
    this.updateAttributes({
      jsonExt: value,
    });
  };

  /**
   * Désérialise les critères sauvegardés dans jsonExt
   * (y compris les objets JSON.stringify comme les Location)
   */
  getDefaultAppliedCustomFilters = () => {
    const benefitPlan = this.props?.edited;
    const jsonExt = benefitPlan?.jsonExt ?? '{}';
    const status = benefitPlan?.status;
    const jsonData = JSON.parse(jsonExt || '{}');

    const filters = jsonData.advanced_criteria?.[status] || [];

    return filters.map((filterItem) => {
      const { custom_filter_condition, referential, typeLocation, amount } = filterItem;
      if (!custom_filter_condition) return CLEARED_STATE_FILTER;

      try {
        const [field, filter, typeValue] = custom_filter_condition.split('__');
        const [type, rawValue] = typeValue.split('=');

        // 🔍 Tentative de retransformer en objet si c’est du JSON
        let value;
        try {
          value = JSON.parse(rawValue);
        } catch {
          value = rawValue; // primitive (string/number)
        }

        return {
          custom_filter_condition,
          field,
          filter,
          type,
          referential: referential || null,
          typeLocation: typeLocation || null,
          amount: amount || null,
          value,
        };
      } catch (error) {
        console.warn('Erreur de parsing des filtres avancés:', error);
        return CLEARED_STATE_FILTER;
      }
    });
  };

  setAppliedCustomFilters = (appliedCustomFilters) => {
    this.setState({ appliedCustomFilters });
  };

  setAppliedFiltersRowStructure = (appliedFiltersRowStructure) => {
    this.setState({ appliedFiltersRowStructure });
  };

  render() {
    const { edited, classes, intl } = this.props;
    const { appliedCustomFilters, appliedFiltersRowStructure } = this.state;

    return (
      <>
        <Grid container className={classes.item}>
          <Grid item xs={3} className={classes.item}>
            <PublishedComponent
              pubRef="socialProtection.BenefitPlanPicker"
              withNull
              required
              filterLabels={false}
              onChange={(benefitPlan) => this.updateAttribute('benefitPlan', benefitPlan)}
              value={edited?.benefitPlan}
            />
          </Grid>
          <Grid item xs={3} className={classes.item}>
            <PublishedComponent
              pubRef="socialProtection.BeneficiaryStatusPicker"
              required
              withNull={false}
              filterLabels={false}
              onChange={(status) => this.updateAttribute('status', status)}
              value={edited?.status}
            />
          </Grid>
        </Grid>

        <Divider />

        <Grid>
          <div className={classes.item}>
            {formatMessage(intl, 'individual', 'individual.enrollment.criteria')}
          </div>

          <Divider />

          <Grid container className={classes.item}>
            <AdvancedCriteriaForm
              object={edited.benefitPlan}
              objectToSave={edited}
              moduleName="individual"
              objectType="Individual"
              setAppliedCustomFilters={this.setAppliedCustomFilters}
              appliedCustomFilters={appliedCustomFilters}
              appliedFiltersRowStructure={appliedFiltersRowStructure}
              setAppliedFiltersRowStructure={this.setAppliedFiltersRowStructure}
              updateAttributes={this.updateJsonExt}
              getDefaultAppliedCustomFilters={this.getDefaultAppliedCustomFilters}
              additionalParams={
                edited?.benefitPlan
                  ? { benefitPlan: `${decodeId(edited.benefitPlan.id)}` }
                  : null
              }
              edited={edited}
            />
          </Grid>
        </Grid>
      </>
    );
  }
}

export default withModulesManager(
  injectIntl(withTheme(withStyles(styles)(EnrollmentHeadPanel))),
);
